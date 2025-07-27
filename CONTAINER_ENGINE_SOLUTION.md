# Container Engine Parameter Solution

## Overview

This document explains the implementation of the `container_engine` parameter as a safer alternative to the privileged `docker_out_of_docker` approach for nested container development.

## Problem Statement

The original PR implemented `docker_out_of_docker` functionality using privileged mode, which:
- Grants root-equivalent privileges to containers
- Breaks sandbox isolation
- Exposes host Docker daemon to containers
- Creates security vulnerabilities

## Solution: Container Engine Parameter

Instead of creating a new runtime, we added a `container_engine` parameter to `SandboxConfig` that allows choosing between Docker and Podman while reusing existing infrastructure.

### Why Parameter vs New Runtime?

1. **Leverages Existing Infrastructure**: `DockerRuntimeBuilder` already detects and supports Podman
2. **Follows Established Patterns**: Other runtime variations (like `docker_out_of_docker`) use configuration parameters
3. **Avoids Code Duplication**: A separate `PodmanRuntime` would duplicate 95% of `DockerRuntime`'s logic
4. **Simpler User Experience**: Users configure `runtime = 'docker'` with `container_engine = 'podman'`
5. **Backward Compatibility**: Existing Docker setups continue working unchanged

## Implementation Details

### Configuration
```toml
[sandbox]
# Container engine to use for running sandbox containers
# Options: "docker" (default) or "podman"
container_engine = "podman"
```

### Key Changes

1. **SandboxConfig** (`openhands/core/config/sandbox_config.py`):
   - Added `container_engine: Literal['docker', 'podman'] = 'docker'` parameter

2. **DockerRuntime** (`openhands/runtime/impl/docker/docker_runtime.py`):
   - Modified `_init_docker_client()` to accept container engine parameter
   - Added Podman socket connection logic (rootless first, then system)
   - Maintained Docker API compatibility

3. **Configuration Template** (`config.template.toml`):
   - Added documentation for the new parameter

4. **Tests** (`tests/unit/test_docker_runtime.py`):
   - Added tests for both Docker and Podman container engine options

### Podman Connection Logic

The implementation tries multiple connection methods for Podman:

1. **Rootless Podman socket** (most secure): `unix:///run/user/{uid}/podman/podman.sock`
2. **System Podman socket**: `unix:///run/podman/podman.sock`
3. **Fallback to Docker-compatible connection**: For Podman in Docker compatibility mode

## Security Benefits

### With Podman (`container_engine = "podman"`):
- ✅ **Rootless operation**: Containers run as non-root user
- ✅ **Better isolation**: No privileged mode required
- ✅ **Sandbox integrity**: Maintains security boundaries
- ✅ **Container functionality**: Full Docker API compatibility

### Comparison with docker_out_of_docker:
- ❌ **Privileged mode**: Grants root-equivalent access
- ❌ **Host exposure**: Mounts Docker socket with full access
- ❌ **Broken isolation**: Compromises sandbox security

## Usage Scenarios

### Secure Container Development (Recommended)
```toml
[sandbox]
container_engine = "podman"
docker_out_of_docker = false  # default
```

### Legacy Docker (Current Default)
```toml
[sandbox]
container_engine = "docker"  # default
docker_out_of_docker = false  # default
```

### Privileged Docker (Not Recommended)
```toml
[sandbox]
container_engine = "docker"
docker_out_of_docker = true  # security risk
```

## Existing Infrastructure Discovered

During implementation, we discovered OpenHands already has:

1. **Podman Support**: `DockerRuntimeBuilder` automatically detects and uses Podman
2. **Nested Conversation Manager**: `DockerNestedConversationManager` runs each agent session in its own container
3. **Container Isolation**: Each agent loop gets isolated container environment

This existing infrastructure could be enhanced further for even better nested development support.

## Future Enhancements

1. **Enhanced Nested Manager**: Use Podman in nested conversation containers
2. **Rootless by Default**: Make Podman the default for new installations
3. **Container Engine Detection**: Auto-detect available engines and recommend safest option
4. **Security Warnings**: Enhanced warnings when using privileged modes

## Testing

All existing tests pass, plus new tests verify:
- Container engine parameter is correctly passed to client initialization
- Both Docker and Podman configurations work as expected
- Backward compatibility is maintained

## Conclusion

The `container_engine` parameter provides a clean, secure solution that:
- Maintains all existing functionality
- Adds Podman support for better security
- Follows OpenHands architectural patterns
- Provides a migration path away from privileged Docker access

This approach is superior to creating a new runtime because it leverages existing infrastructure while providing the security benefits of rootless container operation.