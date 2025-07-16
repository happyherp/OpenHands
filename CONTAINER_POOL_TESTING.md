# Container Pool Feature - Manual Testing Guide

This guide provides instructions for manually testing the container pool feature in the OpenHands webapp.

## Overview

The container pool feature pre-starts Docker containers to reduce runtime startup time. Instead of creating a new container for each session (which can take 10-30 seconds), the system maintains a pool of ready-to-use containers that can be assigned instantly.

## Configuration

The container pool is configured via the `container_pool_size` setting in your OpenHands configuration.

### Option 1: Environment Variable
```bash
export SANDBOX_CONTAINER_POOL_SIZE=2
```

### Option 2: Configuration File
Add to your `config.toml`:
```toml
[sandbox]
container_pool_size = 2
```

### Option 3: Command Line
```bash
python -m openhands.core.main --sandbox-container-pool-size 2
```

## Testing Instructions

### Test 1: Basic Pool Functionality

1. **Start OpenHands with pool enabled:**
   ```bash
   export SANDBOX_CONTAINER_POOL_SIZE=2
   python -m openhands.core.main
   ```

2. **Monitor Docker containers:**
   Open a separate terminal and run:
   ```bash
   watch -n 2 'docker ps --filter "name=openhands-runtime" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"'
   ```

3. **Observe pool creation:**
   - After starting OpenHands, you should see 2 containers with names like `openhands-runtime-pool-*`
   - These containers should be in "running" status
   - They are created during OpenHands startup, not when a session starts

4. **Test session startup speed:**
   - Open the OpenHands webapp in your browser
   - Start a new conversation/session
   - **Expected behavior:** The runtime should connect almost instantly (< 2 seconds)
   - In the Docker monitor, you should see one of the pool containers get renamed to `openhands-runtime-<session-id>`

### Test 2: Pool Exhaustion and Refill

1. **Start multiple sessions:**
   - Open 3 browser tabs/windows with OpenHands
   - Start conversations in each tab quickly (within 30 seconds)

2. **Observe container behavior:**
   - First 2 sessions: Should connect instantly using pooled containers
   - Third session: Should take longer (10-30 seconds) as it creates a new container
   - Pool should automatically create new containers to maintain the pool size

3. **Expected Docker container states:**
   ```
   openhands-runtime-<session1-id>    # From pool
   openhands-runtime-<session2-id>    # From pool  
   openhands-runtime-<session3-id>    # Newly created
   openhands-runtime-pool-*           # New pool containers being created
   ```

### Test 3: Pool Disabled (Control Test)

1. **Start OpenHands without pool:**
   ```bash
   export SANDBOX_CONTAINER_POOL_SIZE=0
   python -m openhands.core.main
   ```

2. **Verify no pool containers:**
   ```bash
   docker ps --filter "name=openhands-runtime"
   ```
   Should show no containers initially.

3. **Test session startup:**
   - Start a new session in the webapp
   - **Expected behavior:** Runtime connection should take 10-30 seconds
   - Only one container should appear: `openhands-runtime-<session-id>`

### Test 4: Performance Comparison

1. **Time the startup with pool enabled:**
   - Configure `container_pool_size = 2`
   - Start OpenHands and wait for pool to be ready
   - Open webapp and start a session
   - **Measure:** Time from clicking "Start" to seeing the runtime ready message

2. **Time the startup with pool disabled:**
   - Configure `container_pool_size = 0`
   - Restart OpenHands
   - Open webapp and start a session
   - **Measure:** Same timing as above

3. **Expected results:**
   - Pool enabled: ~1-3 seconds
   - Pool disabled: ~10-30 seconds
   - Performance improvement should be significant

## Monitoring and Debugging

### Check Pool Status in Logs

Look for these log messages when starting OpenHands:

```
INFO - Setting up container pool with size: 2
INFO - Container pool started successfully
INFO - Pre-started container: openhands-runtime-pool-abc123
INFO - Pre-started container: openhands-runtime-pool-def456
```

During session creation:
```
INFO - Using pooled container: openhands-runtime-pool-abc123
```

### Docker Commands for Monitoring

```bash
# List all OpenHands containers
docker ps --filter "name=openhands-runtime"

# Watch container changes in real-time
watch -n 1 'docker ps --filter "name=openhands-runtime" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"'

# Check container logs
docker logs openhands-runtime-pool-<container-id>

# See container resource usage
docker stats --filter "name=openhands-runtime"
```

### Configuration Verification

Check that your configuration is loaded correctly:

```bash
# If using environment variable
echo $SANDBOX_CONTAINER_POOL_SIZE

# Check OpenHands startup logs for configuration
python -m openhands.core.main | grep -i "container_pool"
```

## Expected Behavior Summary

| Scenario | Pool Size | Startup Time | Containers Created |
|----------|-----------|--------------|-------------------|
| Pool disabled | 0 | 10-30 seconds | 1 per session |
| Pool enabled | 2 | 1-3 seconds | 2 pool + 1 per session |
| Pool exhausted | 2 | Mixed (fast then slow) | Pool refills automatically |

## Troubleshooting

### Pool Not Created
- Check configuration is set correctly
- Verify Docker is running and accessible
- Check OpenHands startup logs for errors
- Ensure ports 30000-31000, 40000-41000, 50000-51000, 55000-56000 are available

### Sessions Still Slow
- Verify pool containers exist: `docker ps --filter "name=openhands-runtime-pool"`
- Check if pool is being used: Look for "Using pooled container" in logs
- Ensure pool size > 0 in configuration

### Container Cleanup Issues
- Pool containers should be cleaned up when OpenHands shuts down
- If containers persist, manually clean up: `docker rm -f $(docker ps -q --filter "name=openhands-runtime")`

## Success Criteria

✅ **Pool Creation**: Pool containers appear during OpenHands startup
✅ **Fast Sessions**: First N sessions (where N = pool size) connect in < 3 seconds  
✅ **Pool Usage**: Pool containers get renamed to session containers
✅ **Pool Refill**: New pool containers created after pool exhaustion
✅ **Proper Cleanup**: Pool containers removed when OpenHands shuts down
✅ **Configuration**: Pool disabled when size = 0

The container pool feature is working correctly if you observe significantly faster session startup times when the pool is enabled compared to when it's disabled.