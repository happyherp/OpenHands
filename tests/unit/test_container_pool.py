"""Unit tests for the container pool functionality."""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from openhands.core.config import OpenHandsConfig
from openhands.runtime.impl.docker.container_pool import ContainerPool, PooledContainer


class TestContainerPool:
    """Test cases for ContainerPool class."""

    @pytest.fixture
    def config(self):
        """Create a test configuration."""
        config = OpenHandsConfig()
        config.sandbox.container_pool_size = 2

        config.sandbox.base_container_image = "python:3.12-slim"
        config.sandbox.runtime_container_image = "test-runtime:latest"
        config.sandbox.use_host_network = False
        config.sandbox.runtime_binding_address = "0.0.0.0"
        config.sandbox.runtime_startup_env_vars = {}
        config.debug = False
        return config

    @pytest.fixture
    def mock_docker_client(self):
        """Create a mock Docker client."""
        mock_client = Mock()
        mock_client.containers = Mock()
        mock_client.containers.run = Mock()
        mock_client.containers.list = Mock(return_value=[])
        return mock_client

    @pytest.fixture
    def mock_runtime_builder(self):
        """Create a mock runtime builder."""
        return Mock()

    def test_container_pool_init(self, config, mock_docker_client, mock_runtime_builder):
        """Test ContainerPool initialization."""
        pool = ContainerPool(
            config=config,
            docker_client=mock_docker_client,
            runtime_builder=mock_runtime_builder,
            pool_size=2,
        )
        
        assert pool.config == config
        assert pool.docker_client == mock_docker_client
        assert pool.runtime_builder == mock_runtime_builder
        assert pool.pool_size == 2
        assert len(pool._pool) == 0

    def test_container_pool_disabled_when_size_zero(self, config, mock_docker_client, mock_runtime_builder):
        """Test that container pool is disabled when pool_size is 0."""
        config.sandbox.container_pool_size = 0
        pool = ContainerPool(
            config=config,
            docker_client=mock_docker_client,
            runtime_builder=mock_runtime_builder,
            pool_size=0,
        )
        
        assert pool.pool_size == 0

    @pytest.mark.asyncio
    async def test_get_container_when_pool_disabled(self, config, mock_docker_client, mock_runtime_builder):
        """Test getting container when pool is disabled."""
        pool = ContainerPool(
            config=config,
            docker_client=mock_docker_client,
            runtime_builder=mock_runtime_builder,
            pool_size=0,
        )
        
        result = await pool.get_container("test-session")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_container_when_pool_empty(self, config, mock_docker_client, mock_runtime_builder):
        """Test getting container when pool is empty."""
        pool = ContainerPool(
            config=config,
            docker_client=mock_docker_client,
            runtime_builder=mock_runtime_builder,
            pool_size=2,
        )
        
        result = await pool.get_container("test-session")
        assert result is None

    @pytest.mark.asyncio
    async def test_start_with_disabled_pool(self, config, mock_docker_client, mock_runtime_builder):
        """Test starting pool when disabled."""
        config.sandbox.container_pool_size = 0
        pool = ContainerPool(
            config=config,
            docker_client=mock_docker_client,
            runtime_builder=mock_runtime_builder,
            pool_size=0,
        )
        
        await pool.start()
        # Should not create any containers
        mock_docker_client.containers.run.assert_not_called()

    def test_pooled_container_dataclass(self):
        """Test PooledContainer dataclass."""
        mock_container = Mock()
        pooled = PooledContainer(
            container=mock_container,
            container_port=8000,
            vscode_port=8001,
            app_ports=[8002, 8003],
            created_at=1234567890.0,
        )
        
        assert pooled.container == mock_container
        assert pooled.container_port == 8000
        assert pooled.vscode_port == 8001
        assert pooled.app_ports == [8002, 8003]
        assert pooled.created_at == 1234567890.0
        assert pooled.reserved is False
        assert pooled.reserved_at is None


class TestContainerPoolConfiguration:
    """Test configuration-related functionality."""

    def test_sandbox_config_has_pool_options(self):
        """Test that SandboxConfig includes container pool options."""
        from openhands.core.config.sandbox_config import SandboxConfig
        
        config = SandboxConfig()
        assert hasattr(config, 'container_pool_size')
        assert config.container_pool_size == 0  # Default disabled

    def test_sandbox_config_with_custom_pool_settings(self):
        """Test SandboxConfig with custom pool settings."""
        from openhands.core.config.sandbox_config import SandboxConfig
        
        config = SandboxConfig(
            container_pool_size=5,
        )
        assert config.container_pool_size == 5