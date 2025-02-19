#!/bin/bash

set -e  # Exit on any error

# Check if running as root
if [ "$(id -u)" = "0" ]; then
    echo "This script should not be run as root"
    exit 1
fi

# Install fish shell
sudo apt-get update
sudo apt-get install -y fish

# Get the path to fish shell
FISH_PATH=$(command -v fish)

# Check if fish is already the default shell
if [ "$SHELL" != "$FISH_PATH" ]; then
    # Change default shell to fish
    echo "Changing default shell to fish..."
    chsh -s "$FISH_PATH"
    echo "Default shell changed to fish. Please log out and log back in for changes to take effect."
else
    echo "Fish is already the default shell."
fi
