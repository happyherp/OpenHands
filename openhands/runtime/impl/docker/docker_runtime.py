import os
import typing
from functools import lru_cache
from typing import Callable
from uuid import UUID

import docker
import httpx
import tenacity
from docker.models.containers import Container

from openhands.core.config import OpenHandsConfig
from openhands.core.exceptions import (
    AgentRuntimeDisconnectedError,
    AgentRuntimeNotFoundError,
)
from openhands.core.logger import DEBUG, DEBUG_RUNTIME
from openhands.core.logger import openhands_logger as logger
from openhands.events import EventStream
from openhands.integrations.provider import PROVIDER_TOKEN_TYPE
from openhands.runtime.builder import DockerRuntimeBuilder
from openhands.runtime.impl.action_execution.action_execution_client import (
    ActionExecutionClient,
)
from openhands.runtime.impl.docker.constants import (
    CONTAINER_NAME_PREFIX,
)
from openhands.runtime.impl.docker.container_factory import ContainerFactory
from openhands.runtime.impl.docker.container_pool import ContainerPool
from openhands.runtime.impl.docker.containers import stop_all_containers
from openhands.runtime.plugins import PluginRequirement
from openhands.runtime.runtime_status import RuntimeStatus
from openhands.runtime.utils.command import (
    DEFAULT_MAIN_MODULE,
    get_action_execution_server_startup_command,
)
from openhands.runtime.utils.image_agnostic import build_runtime_image
from openhands.runtime.utils.log_streamer import LogStreamer
from openhands.utils.async_utils import call_sync_from_async
from openhands.utils.shutdown_listener import add_shutdown_listener
from openhands.utils.tenacity_stop import stop_if_should_exit


def _is_retryablewait_until_alive_error(exception: Exception) -> bool:
    if isinstance(exception, tenacity.RetryError):
        cause = exception.last_attempt.exception()
        return _is_retryablewait_until_alive_error(cause)

    return isinstance(
        exception,
        (
            ConnectionError,
            httpx.ConnectTimeout,
            httpx.NetworkError,
            httpx.RemoteProtocolError,
            httpx.HTTPStatusError,
            httpx.ReadTimeout,
        ),
    )


class DockerRuntime(ActionExecutionClient):
    """This runtime will subscribe the event stream.

    When receive an event, it will send the event to runtime-client which run inside the docker environment.

    Args:
        config (OpenHandsConfig): The application configuration.
        event_stream (EventStream): The event stream to subscribe to.
        sid (str, optional): The session ID. Defaults to 'default'.
        plugins (list[PluginRequirement] | None, optional): List of plugin requirements. Defaults to None.
        env_vars (dict[str, str] | None, optional): Environment variables to set. Defaults to None.
    """

    _shutdown_listener_id: UUID | None = None
    _container_pool: ContainerPool | None = None
    _pool_lock = None

    def __init__(
        self,
        config: OpenHandsConfig,
        event_stream: EventStream,
        sid: str = 'default',
        plugins: list[PluginRequirement] | None = None,
        env_vars: dict[str, str] | None = None,
        status_callback: Callable | None = None,
        attach_to_existing: bool = False,
        headless_mode: bool = True,
        user_id: str | None = None,
        git_provider_tokens: PROVIDER_TOKEN_TYPE | None = None,
        main_module: str = DEFAULT_MAIN_MODULE,
    ):
        if not DockerRuntime._shutdown_listener_id:
            DockerRuntime._shutdown_listener_id = add_shutdown_listener(
                lambda: stop_all_containers(CONTAINER_NAME_PREFIX)
            )

        self.config = config
        self.status_callback = status_callback

        self._host_port = -1
        self._container_port = -1
        self._vscode_port = -1
        self._app_ports: list[int] = []

        if os.environ.get('DOCKER_HOST_ADDR'):
            logger.info(
                f'Using DOCKER_HOST_IP: {os.environ["DOCKER_HOST_ADDR"]} for local_runtime_url'
            )
            self.config.sandbox.local_runtime_url = (
                f'http://{os.environ["DOCKER_HOST_ADDR"]}'
            )

        self.docker_client: docker.DockerClient = self._init_docker_client()
        self.api_url = f'{self.config.sandbox.local_runtime_url}:{self._container_port}'

        self.base_container_image = self.config.sandbox.base_container_image
        self.runtime_container_image = self.config.sandbox.runtime_container_image
        self.container_name = CONTAINER_NAME_PREFIX + sid
        self.container: Container | None = None
        self.main_module = main_module

        self.runtime_builder = DockerRuntimeBuilder(self.docker_client)
        
        # Create container factory for consistent container creation
        self.container_factory = ContainerFactory(
            config, self.docker_client, self.runtime_builder
        )

        # Buffer for container logs
        self.log_streamer: LogStreamer | None = None

        super().__init__(
            config,
            event_stream,
            sid,
            plugins,
            env_vars,
            status_callback,
            attach_to_existing,
            headless_mode,
            user_id,
            git_provider_tokens,
        )

        # Log runtime_extra_deps after base class initialization so self.sid is available
        if self.config.sandbox.runtime_extra_deps:
            self.log(
                'debug',
                f'Installing extra user-provided dependencies in the runtime image: {self.config.sandbox.runtime_extra_deps}',
            )

    @classmethod
    async def _ensure_container_pool(
        cls, config: OpenHandsConfig, plugins: list[PluginRequirement] | None = None
    ) -> None:
        """Ensure the container pool is initialized."""
        if cls._pool_lock is None:
            import asyncio

            cls._pool_lock = asyncio.Lock()

        async with cls._pool_lock:
            if cls._container_pool is None and config.sandbox.container_pool_size > 0:
                docker_client = cls._init_docker_client()
                runtime_builder = DockerRuntimeBuilder(docker_client)
                cls._container_pool = ContainerPool(
                    config=config,
                    docker_client=docker_client,
                    runtime_builder=runtime_builder,
                    pool_size=config.sandbox.container_pool_size,
                    plugins=plugins,
                )
                await cls._container_pool.start()
                logger.info(
                    f'Container pool initialized with size {config.sandbox.container_pool_size}'
                )

    @classmethod
    async def _shutdown_container_pool(cls) -> None:
        """Shutdown the container pool."""
        if cls._pool_lock is None:
            return

        async with cls._pool_lock:
            if cls._container_pool is not None:
                await cls._container_pool.stop()
                cls._container_pool = None
                logger.info('Container pool shut down')

    @property
    def action_execution_server_url(self) -> str:
        return self.api_url

    async def connect(self) -> None:
        self.set_runtime_status(RuntimeStatus.STARTING_RUNTIME)

        # Try to get a container from the pool first
        pooled_container = None
        if not self.attach_to_existing:
            await self._ensure_container_pool(self.config, self.plugins)
            if self._container_pool is not None:
                pooled_container = await self._container_pool.get_container(self.sid)

        if pooled_container is not None:
            # Use pooled container
            self.container = pooled_container.container
            self._host_port = pooled_container.container_port
            self._container_port = pooled_container.container_port
            self._vscode_port = pooled_container.vscode_port
            self._app_ports = pooled_container.app_ports
            self.api_url = (
                f'{self.config.sandbox.local_runtime_url}:{self._container_port}'
            )
            self.log(
                'info',
                f'Using pooled container: {self.container_name}. VSCode URL: {self.vscode_url}',
            )
        else:
            # Fall back to regular container creation
            try:
                await call_sync_from_async(self._attach_to_container)
            except docker.errors.NotFound as e:
                if self.attach_to_existing:
                    self.log(
                        'warning',
                        f'Container {self.container_name} not found.',
                    )
                    raise AgentRuntimeDisconnectedError from e
                self.maybe_build_runtime_container_image()
                self.log(
                    'info',
                    f'Starting runtime with image: {self.runtime_container_image}',
                )
                await call_sync_from_async(self.init_container)
                self.log(
                    'info',
                    f'Container started: {self.container_name}. VSCode URL: {self.vscode_url}',
                )

        if DEBUG_RUNTIME and self.container:
            self.log_streamer = LogStreamer(self.container, self.log)
        else:
            self.log_streamer = None

        if not self.attach_to_existing:
            self.log('info', f'Waiting for client to become ready at {self.api_url}...')
            self.set_runtime_status(RuntimeStatus.STARTING_RUNTIME)

        await call_sync_from_async(self.wait_until_alive)

        if not self.attach_to_existing:
            self.log('info', 'Runtime is ready.')

        if not self.attach_to_existing:
            await call_sync_from_async(self.setup_initial_env)

        self.log(
            'debug',
            f'Container initialized with plugins: {[plugin.name for plugin in self.plugins]}. VSCode URL: {self.vscode_url}',
        )
        if not self.attach_to_existing:
            self.set_runtime_status(RuntimeStatus.READY)
        self._runtime_initialized = True

    def maybe_build_runtime_container_image(self):
        if self.runtime_container_image is None:
            if self.base_container_image is None:
                raise ValueError(
                    'Neither runtime container image nor base container image is set'
                )
            self.set_runtime_status(RuntimeStatus.BUILDING_RUNTIME)
            self.runtime_container_image = build_runtime_image(
                self.base_container_image,
                self.runtime_builder,
                platform=self.config.sandbox.platform,
                extra_deps=self.config.sandbox.runtime_extra_deps,
                force_rebuild=self.config.sandbox.force_rebuild_runtime,
                extra_build_args=self.config.sandbox.runtime_extra_build_args,
            )

    @staticmethod
    @lru_cache(maxsize=1)
    def _init_docker_client() -> docker.DockerClient:
        try:
            return docker.from_env()
        except Exception as ex:
            logger.error(
                'Launch docker client failed. Please make sure you have installed docker and started docker desktop/daemon.',
            )
            raise ex



    def init_container(self) -> None:
        self.log('debug', 'Preparing to start container...')
        self.set_runtime_status(RuntimeStatus.STARTING_RUNTIME)
        
        # Build runtime image if needed
        self.maybe_build_runtime_container_image()
        
        self.log('debug', f'Workspace Base: {self.config.workspace_base}')
        self.log(
            'debug',
            f'Sandbox workspace: {self.config.workspace_mount_path_in_sandbox}',
        )

        # Use container factory to create the container
        try:
            self.container, self._container_port, self._vscode_port, self._app_ports = (
                self.container_factory.create_container(
                    container_name=self.container_name,
                    plugins=self.plugins,
                    initial_env_vars=self.initial_env_vars,
                    vscode_port=self.config.sandbox.vscode_port,  # Use configured port if available
                )
            )
            
            # Set host port to match container port
            self._host_port = self._container_port
            self.api_url = f'{self.config.sandbox.local_runtime_url}:{self._container_port}'
            
            self.log('debug', f'Container started. Server url: {self.api_url}')
            self.set_runtime_status(RuntimeStatus.RUNTIME_STARTED)
            
        except Exception as e:
            self.log(
                'error',
                f'Error: Instance {self.container_name} FAILED to start container!\n',
            )
            self.close()
            raise e

    def _attach_to_container(self) -> None:
        self.container = self.docker_client.containers.get(self.container_name)
        if self.container.status == 'exited':
            self.container.start()

        config = self.container.attrs['Config']
        for env_var in config['Env']:
            if env_var.startswith('port='):
                self._host_port = int(env_var.split('port=')[1])
                self._container_port = self._host_port
            elif env_var.startswith('VSCODE_PORT='):
                self._vscode_port = int(env_var.split('VSCODE_PORT=')[1])

        self._app_ports = []
        exposed_ports = config.get('ExposedPorts')
        if exposed_ports:
            for exposed_port in exposed_ports.keys():
                exposed_port = int(exposed_port.split('/tcp')[0])
                if (
                    exposed_port != self._host_port
                    and exposed_port != self._vscode_port
                ):
                    self._app_ports.append(exposed_port)

        self.api_url = f'{self.config.sandbox.local_runtime_url}:{self._container_port}'
        self.log(
            'debug',
            f'attached to container: {self.container_name} {self._container_port} {self.api_url}',
        )

    @tenacity.retry(
        stop=tenacity.stop_after_delay(120) | stop_if_should_exit(),
        retry=tenacity.retry_if_exception(_is_retryablewait_until_alive_error),
        reraise=True,
        wait=tenacity.wait_fixed(2),
    )
    def wait_until_alive(self) -> None:
        try:
            container = self.docker_client.containers.get(self.container_name)
            if container.status == 'exited':
                raise AgentRuntimeDisconnectedError(
                    f'Container {self.container_name} has exited.'
                )
        except docker.errors.NotFound:
            raise AgentRuntimeNotFoundError(
                f'Container {self.container_name} not found.'
            )

        self.check_if_alive()

    def close(self, rm_all_containers: bool | None = None) -> None:
        """Closes the DockerRuntime and associated objects.

        Parameters:
        - rm_all_containers (bool): Whether to remove all containers with the 'openhands-sandbox-' prefix
        """
        super().close()
        if self.log_streamer:
            self.log_streamer.close()

        if rm_all_containers is None:
            rm_all_containers = self.config.sandbox.rm_all_containers

        if self.config.sandbox.keep_runtime_alive or self.attach_to_existing:
            return
        close_prefix = (
            CONTAINER_NAME_PREFIX if rm_all_containers else self.container_name
        )
        stop_all_containers(close_prefix)

    def _is_port_in_use_docker(self, port: int) -> bool:
        containers = self.docker_client.containers.list()
        for container in containers:
            container_ports = container.ports
            if str(port) in str(container_ports):
                return True
        return False



    @property
    def vscode_url(self) -> str | None:
        token = super().get_vscode_token()
        if not token:
            return None

        vscode_url = f'http://localhost:{self._vscode_port}/?tkn={token}&folder={self.config.workspace_mount_path_in_sandbox}'
        return vscode_url

    @property
    def web_hosts(self) -> dict[str, int]:
        hosts: dict[str, int] = {}

        host_addr = os.environ.get('DOCKER_HOST_ADDR', 'localhost')
        for port in self._app_ports:
            hosts[f'http://{host_addr}:{port}'] = port

        return hosts

    def pause(self) -> None:
        """Pause the runtime by stopping the container.

        This is different from container.stop() as it ensures environment variables are properly preserved.
        """
        if not self.container:
            raise RuntimeError('Container not initialized')

        # First, ensure all environment variables are properly persisted in .bashrc
        # This is already handled by add_env_vars in base.py

        # Stop the container
        self.container.stop()
        self.log('debug', f'Container {self.container_name} paused')

    def resume(self) -> None:
        """Resume the runtime by starting the container.

        This is different from container.start() as it ensures environment variables are properly restored.
        """
        if not self.container:
            raise RuntimeError('Container not initialized')

        # Start the container
        self.container.start()
        self.log('debug', f'Container {self.container_name} resumed')

        # Wait for the container to be ready
        self.wait_until_alive()

    @classmethod
    async def delete(cls, conversation_id: str) -> None:
        docker_client = cls._init_docker_client()
        try:
            container_name = CONTAINER_NAME_PREFIX + conversation_id
            container = docker_client.containers.get(container_name)
            container.remove(force=True)
        except docker.errors.APIError:
            pass
        except docker.errors.NotFound:
            pass
        finally:
            docker_client.close()

    def get_action_execution_server_startup_command(self) -> list[str]:
        return get_action_execution_server_startup_command(
            server_port=self._container_port,
            plugins=self.plugins,
            app_config=self.config,
            main_module=self.main_module,
        )

    @classmethod
    def setup(cls, config: OpenHandsConfig, headless_mode: bool = False):
        """Set up the environment for runtimes to be created."""
        super().setup(config, headless_mode)
        # Initialize container pool if configured
        if config.sandbox.container_pool_size > 0:
            import asyncio

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If we're in an async context, schedule the setup
                    asyncio.create_task(cls._ensure_container_pool(config))
                else:
                    # If we're not in an async context, run it
                    loop.run_until_complete(cls._ensure_container_pool(config))
            except RuntimeError:
                # No event loop, create one
                asyncio.run(cls._ensure_container_pool(config))

    @classmethod
    def teardown(cls, config: OpenHandsConfig):
        """Tear down the environment in which runtimes are created."""
        super().teardown(config)
        # Shutdown container pool
        if cls._container_pool is not None:
            import asyncio

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If we're in an async context, schedule the shutdown
                    asyncio.create_task(cls._shutdown_container_pool())
                else:
                    # If we're not in an async context, run it
                    loop.run_until_complete(cls._shutdown_container_pool())
            except RuntimeError:
                # No event loop, create one
                asyncio.run(cls._shutdown_container_pool())
