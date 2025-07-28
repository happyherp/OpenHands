#!/bin/bash
set -eo pipefail

echo "Starting OpenHands with Sysbox..."

# Start Docker daemon in background for Sysbox
echo "Starting dockerd..."
dockerd &

# Wait for dockerd to be ready with proper health check
echo "Waiting for dockerd to be ready..."
for i in {1..30}; do
    if docker info >/dev/null 2>&1; then
        echo "dockerd is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "ERROR: dockerd failed to start within 30 seconds"
        exit 1
    fi
    sleep 1
done

# Continue with OpenHands setup
if [[ $NO_SETUP == "true" ]]; then
  echo "Skipping setup, running as $(whoami)"
  "$@"
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "The OpenHands entrypoint.sh must run as root"
  exit 1
fi

if [ -z "$SANDBOX_USER_ID" ]; then
  echo "SANDBOX_USER_ID is not set"
  exit 1
fi

if [ -z "$WORKSPACE_MOUNT_PATH" ]; then
  # This is set to /opt/workspace in the Dockerfile. But if the user isn't mounting, we want to unset it so that OpenHands doesn't mount at all
  unset WORKSPACE_BASE
fi

if [[ "$SANDBOX_USER_ID" -eq 0 ]]; then
  echo "Running OpenHands as root"
  export RUN_AS_OPENHANDS=false
  "$@"
else
  echo "Setting up enduser with id $SANDBOX_USER_ID"
  if id "enduser" &>/dev/null; then
    echo "User enduser already exists. Skipping creation."
  else
    if ! useradd -l -m -u $SANDBOX_USER_ID -s /bin/bash enduser; then
      echo "Failed to create user enduser with id $SANDBOX_USER_ID. Moving openhands user."
      incremented_id=$(($SANDBOX_USER_ID + 1))
      usermod -u $incremented_id openhands
      if ! useradd -l -m -u $SANDBOX_USER_ID -s /bin/bash enduser; then
        echo "Failed to create user enduser with id $SANDBOX_USER_ID for a second time. Exiting."
        exit 1
      fi
    fi
  fi
  usermod -aG app enduser

  # For Sysbox, we don't need to handle Docker socket permissions since Docker runs inside the container
  # But we still add the user to the docker group for Docker commands
  usermod -aG docker enduser

  mkdir -p /home/enduser/.cache/huggingface/hub/

  echo "Running as enduser"
  su enduser /bin/bash -c "${*@Q}" # This magically runs any arguments passed to the script as a command
fi
