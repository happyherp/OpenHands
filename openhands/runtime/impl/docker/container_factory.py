"""Factory for creating Docker containers with consistent configuration."""

import os
import typing
from typing import Optional

import docker
from docker.models.containers import Container

from openhands.core.config import OpenHandsConfig
from openhands.core.logger import openhands_logger as logger
from openhands.runtime.builder import DockerRuntimeBuilder
from openhands.runtime.impl.docker.constants import (
    APP_PORT_RANGE_1,
    APP_PORT_RANGE_2,
    EXECUTION_SERVER_PORT_RANGE,
    VSCODE_PORT_RANGE,
)
from openhands.runtime.plugins import PluginRequirement
from openhands.runtime.utils import find_available_tcp_port
from openhands.runtime.utils.command import (
    DEFAULT_MAIN_MODULE,
    get_action_execution_server_startup_command,
)
from openhands.runtime.utils.runtime_build import build_runtime_image


class ContainerFactory:
    """Factory for creating Docker containers with consistent configuration."""

    def __init__(
        self,
        config: OpenHandsConfig,
        docker_client: docker.DockerClient,
        runtime_builder: DockerRuntimeBuilder,
    ):
        self.config = config
        self.docker_client = docker_client
        self.runtime_builder = runtime_builder

    def create_container(
        self,
        container_name: str,
        plugins: list[PluginRequirement],
        volumes: Optional[dict[str, dict[str, str]]] = None,
        container_port: Optional[int] = None,
        vscode_port: Optional[int] = None,
        app_ports: Optional[list[int]] = None,
        initial_env_vars: Optional[dict[str, str]] = None,
    ) -> tuple[Container, int, int, list[int]]:
        """Create a Docker container with the specified configuration.
        
        Args:
            container_name: Name for the container
            plugins: List of plugins to install
            volumes: Volume mounts (if None, will be computed from config)
            container_port: Port for the execution server (if None, will find available)
            vscode_port: Port for VSCode server (if None, will find available)
            app_ports: Ports for applications (if None, will find available)
            initial_env_vars: Additional environment variables
            
        Returns:
            Tuple of (container, container_port, vscode_port, app_ports)
        """
        # Find available ports if not provided
        if container_port is None:
            container_port = self._find_available_port(EXECUTION_SERVER_PORT_RANGE)
        if vscode_port is None:
            vscode_port = (
                self.config.sandbox.vscode_port
                or self._find_available_port(VSCODE_PORT_RANGE)
            )
        if app_ports is None:
            app_ports = [
                self._find_available_port(APP_PORT_RANGE_1),
                self._find_available_port(APP_PORT_RANGE_2),
            ]

        # Build runtime image if needed
        runtime_container_image = self._get_runtime_image()

        # Setup environment variables
        environment = self._build_environment(
            container_port, vscode_port, app_ports, initial_env_vars
        )

        # Setup network and port mapping
        network_mode, port_mapping = self._setup_networking(
            container_port, vscode_port, app_ports
        )

        # Process volumes if not provided
        if volumes is None:
            volumes = self._process_volumes()

        # Get startup command
        command = get_action_execution_server_startup_command(
            server_port=container_port,
            plugins=plugins,
            app_config=self.config,
            main_module=DEFAULT_MAIN_MODULE,
        )

        # Setup GPU if enabled
        device_requests = self._setup_gpu()

        # Create and start container
        try:
            container = self.docker_client.containers.run(  # type: ignore[call-overload]
                runtime_container_image,
                command=command,
                entrypoint=[],
                network_mode=network_mode,
                ports=port_mapping,
                working_dir='/openhands/code/',
                name=container_name,
                detach=True,
                environment=environment,
                volumes=volumes,
                device_requests=device_requests,
                **(self.config.sandbox.docker_runtime_kwargs or {}),
            )
            assert isinstance(container, Container)  # Type assertion for mypy
            return container, container_port, vscode_port, app_ports

        except Exception as e:
            logger.error(f'Error creating container {container_name}: {e}')
            raise

    def _get_runtime_image(self) -> str:
        """Get or build the runtime container image."""
        runtime_container_image = self.config.sandbox.runtime_container_image
        if runtime_container_image is None:
            if self.config.sandbox.base_container_image is None:
                raise ValueError(
                    'Neither runtime container image nor base container image is set'
                )
            runtime_container_image = build_runtime_image(
                self.config.sandbox.base_container_image,
                self.runtime_builder,
                platform=self.config.sandbox.platform,
                extra_deps=self.config.sandbox.runtime_extra_deps,
                force_rebuild=self.config.sandbox.force_rebuild_runtime,
                extra_build_args=self.config.sandbox.runtime_extra_build_args,
            )
        return runtime_container_image

    def _build_environment(
        self,
        container_port: int,
        vscode_port: int,
        app_ports: list[int],
        initial_env_vars: Optional[dict[str, str]] = None,
    ) -> dict[str, str]:
        """Build environment variables for the container."""
        environment = dict(**(initial_env_vars or {}))
        environment.update(
            {
                'port': str(container_port),
                'PYTHONUNBUFFERED': '1',
                'VSCODE_PORT': str(vscode_port),
                'APP_PORT_1': str(app_ports[0]),
                'APP_PORT_2': str(app_ports[1]),
                'PIP_BREAK_SYSTEM_PACKAGES': '1',
            }
        )

        # Add debug flag if needed
        if self.config.debug:
            environment['DEBUG'] = 'true'

        # Add runtime startup env vars
        environment.update(self.config.sandbox.runtime_startup_env_vars)

        return environment

    def _setup_networking(
        self, container_port: int, vscode_port: int, app_ports: list[int]
    ) -> tuple[typing.Literal['host'] | None, dict[str, list[dict[str, str]]] | None]:
        """Setup network mode and port mapping."""
        use_host_network = self.config.sandbox.use_host_network
        network_mode: typing.Literal['host'] | None = (
            'host' if use_host_network else None
        )

        port_mapping: dict[str, list[dict[str, str]]] | None = None
        if not use_host_network:
            port_mapping = {
                f'{container_port}/tcp': [
                    {
                        'HostPort': str(container_port),
                        'HostIp': self.config.sandbox.runtime_binding_address,
                    }
                ],
                f'{vscode_port}/tcp': [
                    {
                        'HostPort': str(vscode_port),
                        'HostIp': self.config.sandbox.runtime_binding_address,
                    }
                ],
            }

            for port in app_ports:
                port_mapping[f'{port}/tcp'] = [
                    {
                        'HostPort': str(port),
                        'HostIp': self.config.sandbox.runtime_binding_address,
                    }
                ]

        return network_mode, port_mapping

    def _process_volumes(self) -> dict[str, dict[str, str]]:
        """Process volume mounts based on configuration.

        Returns:
            A dictionary mapping host paths to container bind mounts with their modes.
        """
        volumes: dict[str, dict[str, str]] = {}

        # Process volumes (comma-delimited)
        if self.config.sandbox.volumes is not None:
            mounts = self.config.sandbox.volumes.split(',')

            for mount in mounts:
                parts = mount.split(':')
                if len(parts) >= 2:
                    host_path = os.path.abspath(parts[0])
                    container_path = parts[1]
                    mount_mode = parts[2] if len(parts) > 2 else 'rw'

                    volumes[host_path] = {
                        'bind': container_path,
                        'mode': mount_mode,
                    }
                    logger.debug(
                        f'Mount dir (sandbox.volumes): {host_path} to {container_path} with mode: {mount_mode}'
                    )

        # Legacy mounting with workspace_* parameters
        elif (
            self.config.workspace_mount_path is not None
            and self.config.workspace_mount_path_in_sandbox is not None
        ):
            mount_mode = 'rw'
            volumes[os.path.abspath(self.config.workspace_mount_path)] = {
                'bind': self.config.workspace_mount_path_in_sandbox,
                'mode': mount_mode,
            }
            logger.debug(
                f'Mount dir (legacy): {self.config.workspace_mount_path} with mode: {mount_mode}'
            )

        return volumes

    def _setup_gpu(self) -> Optional[list]:
        """Setup GPU device requests if enabled."""
        if not self.config.sandbox.enable_gpu:
            return None

        gpu_ids = self.config.sandbox.cuda_visible_devices
        if gpu_ids is None:
            return [docker.types.DeviceRequest(capabilities=[['gpu']], count=-1)]
        else:
            return [
                docker.types.DeviceRequest(
                    capabilities=[['gpu']],
                    device_ids=[str(i) for i in gpu_ids.split(',')],
                )
            ]

    def _find_available_port(
        self, port_range: tuple[int, int], max_attempts: int = 5
    ) -> int:
        """Find an available port in the given range."""
        port = port_range[1]
        for _ in range(max_attempts):
            port = find_available_tcp_port(port_range[0], port_range[1])
            if not self._is_port_in_use_docker(port):
                return port
        return port

    def _is_port_in_use_docker(self, port: int) -> bool:
        """Check if a port is in use by any Docker container."""
        containers = self.docker_client.containers.list()
        for container in containers:
            container_ports = container.ports
            if str(port) in str(container_ports):
                return True
        return False