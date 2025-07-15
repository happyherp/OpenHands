"""Container pool for pre-starting Docker containers to reduce startup time."""

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

import docker
from docker.models.containers import Container

from openhands.core.config import OpenHandsConfig
from openhands.core.logger import openhands_logger as logger
from openhands.runtime.impl.docker.containers import stop_all_containers
from openhands.runtime.utils import find_available_tcp_port
from openhands.runtime.utils.command import (
    DEFAULT_MAIN_MODULE,
    get_action_execution_server_startup_command,
)
from openhands.runtime.plugins import PluginRequirement
from openhands.runtime.utils.runtime_build import build_runtime_image
from openhands.runtime.builder import DockerRuntimeBuilder


@dataclass
class PooledContainer:
    """Represents a container in the pool."""
    container: Container
    container_port: int
    vscode_port: int
    app_ports: List[int]
    created_at: float
    reserved: bool = False
    reserved_at: Optional[float] = None


class ContainerPool:
    """Manages a pool of pre-started Docker containers."""
    
    def __init__(
        self,
        config: OpenHandsConfig,
        docker_client: docker.DockerClient,
        runtime_builder: DockerRuntimeBuilder,
        pool_size: int = 0,
    ):
        self.config = config
        self.docker_client = docker_client
        self.runtime_builder = runtime_builder
        self.pool_size = pool_size
        
        self._pool: Dict[str, PooledContainer] = {}
        self._pool_lock = asyncio.Lock()
        self._maintenance_task: Optional[asyncio.Task] = None
        self._shutdown = False
        
        # Port ranges (same as in docker_runtime.py)
        self.EXECUTION_SERVER_PORT_RANGE = (30000, 39999)
        self.VSCODE_PORT_RANGE = (40000, 49999)
        self.APP_PORT_RANGE_1 = (50000, 54999)
        self.APP_PORT_RANGE_2 = (55000, 59999)
        
    async def start(self) -> None:
        """Start the container pool."""
        if self.pool_size <= 0:
            logger.info("Container pool disabled (pool_size=0)")
            return
            
        logger.info(f"Starting container pool with size {self.pool_size}")
        
        # Start maintenance task
        self._maintenance_task = asyncio.create_task(self._maintenance_loop())
        
        # Pre-populate the pool
        await self._fill_pool()
        
    async def stop(self) -> None:
        """Stop the container pool and clean up resources."""
        self._shutdown = True
        
        if self._maintenance_task:
            self._maintenance_task.cancel()
            try:
                await self._maintenance_task
            except asyncio.CancelledError:
                pass
                
        # Stop all pooled containers
        async with self._pool_lock:
            for container_id, pooled_container in self._pool.items():
                try:
                    pooled_container.container.stop()
                    pooled_container.container.remove()
                except Exception as e:
                    logger.warning(f"Error stopping pooled container {container_id}: {e}")
            self._pool.clear()
            
    async def get_container(self, sid: str) -> Optional[PooledContainer]:
        """Get a container from the pool for the given session ID."""
        if self.pool_size <= 0:
            return None
            
        async with self._pool_lock:
            # Find an available container
            for container_id, pooled_container in self._pool.items():
                if not pooled_container.reserved:
                    # Reserve the container
                    pooled_container.reserved = True
                    pooled_container.reserved_at = time.time()
                    
                    # Rename the container to match the session
                    try:
                        new_name = f"openhands-runtime-{sid}"
                        pooled_container.container.rename(new_name)
                        logger.info(f"Assigned pooled container {container_id} to session {sid}")
                        return pooled_container
                    except Exception as e:
                        logger.error(f"Error renaming container {container_id}: {e}")
                        # Release the reservation
                        pooled_container.reserved = False
                        pooled_container.reserved_at = None
                        continue
                        
        logger.debug("No available containers in pool")
        return None
        
    async def return_container(self, container: Container) -> None:
        """Return a container to the pool (not implemented - containers are disposed after use)."""
        # For now, we don't return containers to the pool after use
        # This could be implemented in the future for better resource utilization
        pass
        
    async def _fill_pool(self) -> None:
        """Fill the pool with pre-started containers."""
        async with self._pool_lock:
            current_available = sum(1 for pc in self._pool.values() if not pc.reserved)
            needed = self.pool_size - current_available
            
            if needed <= 0:
                return
                
        logger.info(f"Creating {needed} containers for pool")
        
        # Create containers concurrently
        tasks = []
        for _ in range(needed):
            task = asyncio.create_task(self._create_pooled_container())
            tasks.append(task)
            
        # Wait for all containers to be created
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = 0
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error creating pooled container: {result}")
            elif result is not None:
                success_count += 1
                
        logger.info(f"Successfully created {success_count} pooled containers")
        
    async def _create_pooled_container(self) -> Optional[PooledContainer]:
        """Create a single pre-started container for the pool."""
        try:
            # Generate unique container ID
            container_id = str(uuid.uuid4())
            container_name = f"openhands-pool-{container_id}"
            
            # Find available ports
            container_port = self._find_available_port(self.EXECUTION_SERVER_PORT_RANGE)
            vscode_port = self._find_available_port(self.VSCODE_PORT_RANGE)
            app_ports = [
                self._find_available_port(self.APP_PORT_RANGE_1),
                self._find_available_port(self.APP_PORT_RANGE_2),
            ]
            
            # Build runtime image if needed
            runtime_container_image = self.config.sandbox.runtime_container_image
            if runtime_container_image is None:
                if self.config.sandbox.base_container_image is None:
                    raise ValueError('Neither runtime container image nor base container image is set')
                runtime_container_image = build_runtime_image(
                    self.config.sandbox.base_container_image,
                    self.runtime_builder,
                    platform=self.config.sandbox.platform,
                    extra_deps=self.config.sandbox.runtime_extra_deps,
                    force_rebuild=self.config.sandbox.force_rebuild_runtime,
                    extra_build_args=self.config.sandbox.runtime_extra_build_args,
                )
            
            # Prepare environment variables
            environment = {
                'port': str(container_port),
                'PYTHONUNBUFFERED': '1',
                'VSCODE_PORT': str(vscode_port),
                'APP_PORT_1': str(app_ports[0]),
                'APP_PORT_2': str(app_ports[1]),
                'PIP_BREAK_SYSTEM_PACKAGES': '1',
            }
            
            # Add debug flag if needed
            if self.config.debug:
                environment['DEBUG'] = 'true'
                
            # Add runtime startup env vars
            environment.update(self.config.sandbox.runtime_startup_env_vars)
            
            # Prepare port mapping
            use_host_network = self.config.sandbox.use_host_network
            network_mode = 'host' if use_host_network else None
            port_mapping = None
            
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
            
            # Get startup command
            command = get_action_execution_server_startup_command(
                server_port=container_port,
                plugins=[],  # No plugins for pooled containers initially
                app_config=self.config,
                main_module=DEFAULT_MAIN_MODULE,
            )
            
            # Create and start container
            container = self.docker_client.containers.run(
                runtime_container_image,
                command=command,
                entrypoint=[],
                network_mode=network_mode,
                ports=port_mapping,
                working_dir='/openhands/code/',
                name=container_name,
                detach=True,
                environment=environment,
                volumes={},  # No volumes for pooled containers initially
                **(self.config.sandbox.docker_runtime_kwargs or {}),
            )
            
            # Wait for container to be ready
            await self._wait_for_container_ready(container, container_port)
            
            # Create pooled container object
            pooled_container = PooledContainer(
                container=container,
                container_port=container_port,
                vscode_port=vscode_port,
                app_ports=app_ports,
                created_at=time.time(),
            )
            
            # Add to pool
            async with self._pool_lock:
                self._pool[container_id] = pooled_container
                
            logger.debug(f"Created pooled container {container_id}")
            return pooled_container
            
        except Exception as e:
            logger.error(f"Error creating pooled container: {e}")
            return None
            
    async def _wait_for_container_ready(self, container: Container, port: int) -> None:
        """Wait for a container to be ready to accept connections."""
        import httpx
        import tenacity
        
        api_url = f"{self.config.sandbox.local_runtime_url}:{port}"
        
        @tenacity.retry(
            stop=tenacity.stop_after_delay(60),
            retry=tenacity.retry_if_exception_type((
                ConnectionError,
                httpx.ConnectTimeout,
                httpx.NetworkError,
                httpx.RemoteProtocolError,
                httpx.HTTPStatusError,
                httpx.ReadTimeout,
            )),
            wait=tenacity.wait_fixed(2),
        )
        def check_alive():
            try:
                with httpx.Client() as client:
                    response = client.get(f"{api_url}/alive", timeout=5)
                    response.raise_for_status()
            except Exception as e:
                # Check if container is still running
                container.reload()
                if container.status == 'exited':
                    raise RuntimeError(f"Container {container.name} has exited")
                raise e
                
        # Run the check in a thread to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, check_alive)
        
    def _find_available_port(self, port_range: tuple[int, int], max_attempts: int = 5) -> int:
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
        
    async def _maintenance_loop(self) -> None:
        """Background task to maintain the pool."""
        while not self._shutdown:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                if self._shutdown:
                    break
                    
                # Clean up old containers and fill pool
                await self._cleanup_old_containers()
                await self._fill_pool()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in container pool maintenance: {e}")
                
    async def _cleanup_old_containers(self) -> None:
        """Remove unhealthy containers from the pool."""
        to_remove = []
        
        async with self._pool_lock:
            for container_id, pooled_container in self._pool.items():
                should_remove = False
                    
                # Check if container is still running
                try:
                    pooled_container.container.reload()
                    if pooled_container.container.status != 'running':
                        should_remove = True
                        logger.debug(f"Removing non-running pooled container {container_id}")
                except Exception:
                    should_remove = True
                    logger.debug(f"Removing unreachable pooled container {container_id}")
                    
                if should_remove:
                    to_remove.append(container_id)
                    
            # Remove containers
            for container_id in to_remove:
                pooled_container = self._pool.pop(container_id, None)
                if pooled_container:
                    try:
                        pooled_container.container.stop()
                        pooled_container.container.remove()
                    except Exception as e:
                        logger.warning(f"Error removing pooled container {container_id}: {e}")