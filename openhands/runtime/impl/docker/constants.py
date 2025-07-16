"""Shared constants for Docker runtime implementation."""

# Port ranges for Docker containers
EXECUTION_SERVER_PORT_RANGE = (30000, 39999)
VSCODE_PORT_RANGE = (40000, 49999)
APP_PORT_RANGE_1 = (50000, 54999)
APP_PORT_RANGE_2 = (55000, 59999)

# Container name prefix
CONTAINER_NAME_PREFIX = 'openhands-runtime-'
