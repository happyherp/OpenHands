#!/usr/bin/env python3
"""Simple test script to verify container pool functionality."""

import asyncio
import time
from openhands.core.config import OpenHandsConfig
from openhands.runtime.impl.docker.docker_runtime import DockerRuntime


async def test_container_pool():
    """Test the container pool functionality."""
    print("Testing container pool functionality...")
    
    # Create config with container pool enabled
    config = OpenHandsConfig()
    config.sandbox.container_pool_size = 2
    config.sandbox.base_container_image = "python:3.12-slim"
    
    print(f"Container pool size: {config.sandbox.container_pool_size}")
    
    # Setup the runtime (this should initialize the pool)
    print("Setting up DockerRuntime...")
    DockerRuntime.setup(config)
    
    # Wait a bit for the pool to initialize
    await asyncio.sleep(5)
    
    # Check if pool was created
    if DockerRuntime._container_pool is not None:
        print(f"Container pool created successfully!")
        print(f"Pool size: {len(DockerRuntime._container_pool._pool)}")
    else:
        print("Container pool was not created")
        return
    
    # Test getting a container from the pool
    print("Testing container allocation...")
    start_time = time.time()
    
    pooled_container = await DockerRuntime._container_pool.get_container("test-session-1")
    
    end_time = time.time()
    
    if pooled_container:
        print(f"Got container from pool in {end_time - start_time:.2f} seconds")
        print(f"Container ID: {pooled_container.container.id[:12]}")
        print(f"Container port: {pooled_container.container_port}")
    else:
        print("Failed to get container from pool")
    
    # Cleanup
    print("Cleaning up...")
    DockerRuntime.teardown(config)
    print("Test completed!")


if __name__ == "__main__":
    asyncio.run(test_container_pool())