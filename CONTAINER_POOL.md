# Container Pool Feature

This document describes the container pool feature that reduces runtime startup time by pre-starting Docker containers.

## Overview

The container pool feature addresses the issue where starting a new conversation takes a long time because:
1. A new Docker container needs to be created
2. The runtime image needs to be built (if not cached)
3. The container needs to start and become ready
4. The environment needs to be set up

With the container pool, containers are pre-started and kept ready in a pool. When a user starts a new conversation, a pre-started container is assigned immediately, significantly reducing wait time.

## Configuration

Add the following configuration options to your `config.toml` file:

```toml
[sandbox]
# Number of containers to keep ready in the pool (default: 0, disabled)
container_pool_size = 2
```

### Configuration Options

- `container_pool_size`: Number of containers to keep ready in the pool. Set to 0 to disable container pooling.

## How It Works

1. **Pool Initialization**: When the DockerRuntime is set up, a container pool is created with the specified number of pre-started containers.

2. **Container Assignment**: When a new conversation starts, the system first tries to get a container from the pool. If available, the container is renamed and assigned to the session.

3. **Fallback**: If no pooled containers are available, the system falls back to the regular container creation process.

4. **Pool Maintenance**: A background task continuously monitors the pool, removing unhealthy containers and creating new ones to maintain the desired pool size. Containers remain in the pool indefinitely unless they become unhealthy.

5. **Cleanup**: When the system shuts down, all pooled containers are properly stopped and removed.

## Benefits

- **Faster Startup**: New conversations start almost immediately when pooled containers are available
- **Better User Experience**: Reduced waiting time for users
- **Resource Efficiency**: Containers are pre-warmed and ready to use
- **Automatic Management**: The pool automatically maintains the desired number of ready containers

## Considerations

- **Resource Usage**: Pooled containers consume system resources even when not in use
- **Memory**: Each pooled container uses memory for the runtime environment
- **Storage**: Container images and volumes consume disk space
- **Network Ports**: Each pooled container reserves network ports

## Monitoring

The system logs information about pool operations:
- Pool initialization and shutdown
- Container creation and assignment
- Pool maintenance activities
- Error conditions

## Example Usage

1. Enable container pooling in your configuration:
```toml
[sandbox]
container_pool_size = 3
```

2. Start OpenHands normally. The container pool will be initialized automatically.

3. When users start new conversations, they will be assigned pre-started containers from the pool, resulting in faster startup times.

## Troubleshooting

- **Pool not starting**: Check Docker daemon is running and accessible
- **Containers not being created**: Verify base container image is available
- **Port conflicts**: Ensure sufficient ports are available in the configured ranges
- **Resource limits**: Monitor system resources to ensure sufficient capacity for pooled containers

## Implementation Details

The container pool is implemented in:
- `openhands/runtime/impl/docker/container_pool.py`: Core pool management
- `openhands/runtime/impl/docker/docker_runtime.py`: Integration with DockerRuntime
- `openhands/core/config/sandbox_config.py`: Configuration options

The pool uses the same container configuration as regular runtime containers but without volumes initially mounted (volumes are configured when the container is assigned to a session).