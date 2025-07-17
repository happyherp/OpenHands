"""Container pool for pre-starting Docker containers to reduce startup time."""

import asyncio
import time
import uuid
from dataclasses import dataclass
from typing import Optional

import docker
from docker.models.containers import Container

from openhands.core.config import OpenHandsConfig
from openhands.core.logger import openhands_logger as logger
from openhands.runtime.builder import DockerRuntimeBuilder
from openhands.runtime.impl.docker.container_factory import ContainerFactory
from openhands.runtime.plugins import (
    AgentSkillsRequirement,
    JupyterRequirement,
    PluginRequirement,
)


@dataclass
class PooledContainer:
    """Represents a container in the pool."""

    container: Container
    container_port: int
    vscode_port: int
    app_ports: list[int]
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
        plugins: Optional[list[PluginRequirement]] = None,
    ):
        self.config = config
        self.docker_client = docker_client
        self.runtime_builder = runtime_builder
        self.pool_size = pool_size

        # Use default plugins if none provided
        if plugins is None:
            # Default plugins that most agents use
            self.plugins = [
                AgentSkillsRequirement(),
                JupyterRequirement(),
            ]
        else:
            self.plugins = plugins

        # Create container factory for consistent container creation
        self.container_factory = ContainerFactory(
            config, docker_client, runtime_builder
        )

        self._pool: dict[str, PooledContainer] = {}
        self._pool_lock = asyncio.Lock()
        self._maintenance_task: Optional[asyncio.Task] = None
        self._shutdown = False
        self._last_failure_time: Optional[float] = None
        self._failure_backoff_seconds = 300  # 5 minutes backoff after failures
        self._max_containers_per_batch = 3  # Limit concurrent container creation

    async def start(self) -> None:
        """Start the container pool."""
        if self.pool_size <= 0:
            logger.info('Container pool disabled (pool_size=0)')
            return

        logger.info(f'Starting container pool with size {self.pool_size}')

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
                    logger.warning(
                        f'Error stopping pooled container {container_id}: {e}'
                    )
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
                        new_name = f'openhands-runtime-{sid}'
                        pooled_container.container.rename(new_name)
                        logger.info(
                            f'Assigned pooled container {container_id} to session {sid}'
                        )
                        return pooled_container
                    except Exception as e:
                        logger.error(f'Error renaming container {container_id}: {e}')
                        # Release the reservation
                        pooled_container.reserved = False
                        pooled_container.reserved_at = None
                        continue

        logger.debug('No available containers in pool')
        return None

    async def return_container(self, container: Container) -> None:
        """Return a container to the pool (not implemented - containers are disposed after use)."""
        # For now, we don't return containers to the pool after use
        # This could be implemented in the future for better resource utilization
        pass

    async def _fill_pool(self) -> None:
        """Fill the pool with pre-started containers."""
        # Check if we should skip due to recent failures
        current_time = time.time()
        if (self._last_failure_time is not None and 
            current_time - self._last_failure_time < self._failure_backoff_seconds):
            logger.debug('Skipping pool fill due to recent failures (backoff period)')
            return

        async with self._pool_lock:
            current_available = sum(1 for pc in self._pool.values() if not pc.reserved)
            needed = self.pool_size - current_available

            if needed <= 0:
                return

        # Limit the number of containers created in one batch to prevent resource exhaustion
        containers_to_create = min(needed, self._max_containers_per_batch)
        logger.info(f'Creating {containers_to_create} containers for pool (needed: {needed})')

        # Create containers one by one to avoid overwhelming the system
        # and to properly track successful creations
        success_count = 0
        for i in range(containers_to_create):
            try:
                result = await self._create_pooled_container()
                if result is not None:
                    success_count += 1
                else:
                    logger.warning(f'Failed to create pooled container {i+1}/{containers_to_create}')
                    # Stop trying if we're failing to create containers
                    # to prevent infinite loops and resource exhaustion
                    self._last_failure_time = current_time
                    break
            except Exception as e:
                logger.error(f'Error creating pooled container {i+1}/{containers_to_create}: {e}')
                # Stop trying if we're getting exceptions
                self._last_failure_time = current_time
                break

        if success_count > 0:
            logger.info(f'Successfully created {success_count} pooled containers')
            # Reset failure time on success
            self._last_failure_time = None
        else:
            logger.warning('Failed to create any pooled containers')
            self._last_failure_time = current_time

    async def _create_pooled_container(self) -> Optional[PooledContainer]:
        """Create a single pre-started container for the pool."""
        try:
            # Generate unique container ID and name
            container_id = str(uuid.uuid4())
            container_name = f'openhands-pool-{container_id}'

            # Use container factory to create the container
            # No volumes for pooled containers initially - they'll be added when assigned
            container, container_port, vscode_port, app_ports = (
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    self.container_factory.create_container,
                    container_name,
                    self.plugins,
                    {},  # Empty volumes for pooled containers
                )
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

            logger.debug(f'Created pooled container {container_id}')
            return pooled_container

        except Exception as e:
            logger.error(f'Error creating pooled container: {e}')
            return None

    async def _wait_for_container_ready(self, container: Container, port: int) -> None:
        """Wait for a container to be ready to accept connections."""
        import httpx
        import tenacity

        api_url = f'{self.config.sandbox.local_runtime_url}:{port}'

        @tenacity.retry(
            stop=tenacity.stop_after_delay(60),
            retry=tenacity.retry_if_exception_type(
                (
                    ConnectionError,
                    httpx.ConnectTimeout,
                    httpx.NetworkError,
                    httpx.RemoteProtocolError,
                    httpx.HTTPStatusError,
                    httpx.ReadTimeout,
                )
            ),
            wait=tenacity.wait_fixed(2),
        )
        def check_alive():
            try:
                with httpx.Client() as client:
                    response = client.get(f'{api_url}/alive', timeout=5)
                    response.raise_for_status()
            except Exception as e:
                # Check if container is still running
                container.reload()
                if container.status == 'exited':
                    raise RuntimeError(f'Container {container.name} has exited')
                raise e

        # Run the check in a thread to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, check_alive)



    async def _maintenance_loop(self) -> None:
        """Background task to maintain the pool."""
        while not self._shutdown:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds

                # Clean up old containers and fill pool
                await self._cleanup_old_containers()
                await self._fill_pool()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f'Error in container pool maintenance: {e}')

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
                        logger.debug(
                            f'Removing non-running pooled container {container_id}'
                        )
                except Exception:
                    should_remove = True
                    logger.debug(
                        f'Removing unreachable pooled container {container_id}'
                    )

                if should_remove:
                    to_remove.append(container_id)

            # Remove containers
            for container_id in to_remove:
                if container_id in self._pool:
                    pooled_container = self._pool.pop(container_id)
                    try:
                        pooled_container.container.stop()
                        pooled_container.container.remove()
                    except Exception as e:
                        logger.warning(
                            f'Error removing pooled container {container_id}: {e}'
                        )
