#!/bin/bash

# --- Script to setup an Arch-based system with dotfiles and fish ---

set -e # Exit immediately if a command exits with a non-zero status.

DOTFILES_DIR="$HOME/dotfiles"

echo "Installing paru (AUR helper)..."

# Check if paru is already installed
if command -v paru >/dev/null 2>&1; then
  echo "paru is already installed. Skipping."
else
  # Install base-devel if not present
  sudo pacman -S --needed --noconfirm base-devel || {
    echo "Error: Failed to install base-devel. Exiting."
    exit 1
  }

  # Clone paru repository
  PARU_DIR="$HOME/paru-build"
  if [ -d "$PARU_DIR" ]; then
    echo "Removing existing paru build directory..."
    rm -rf "$PARU_DIR"
  fi

  git clone https://aur.archlinux.org/paru.git "$PARU_DIR" || {
    echo "Error: Failed to clone paru repository. Exiting."
    exit 1
  }

  # Build and install paru
  cd "$PARU_DIR" || {
    echo "Error: Could not change directory to $PARU_DIR. Exiting."
    exit 1
  }

  makepkg -si --noconfirm || {
    echo "Error: Failed to build/install paru. Exiting."
    cd "$HOME"
    exit 1
  }

  # Clean up
  cd "$HOME"
  rm -rf "$PARU_DIR"
  echo "paru installed successfully and build directory cleaned up."
fi

echo "Installing required packages..."
# Packages sorted from most fundamental to least fundamental
sudo pacman -S --noconfirm \
  stow \
  qt5-wayland \
  gnome-keyring \
  polkit-gnome \
  xdg-desktop-portal-gnome \
  ly \
  niri \
  xwayland-satellite \
  kvantum \
  kvantum-qt5 \
  breeze \
  breeze5 \
  breeze-gtk \
  papirus-icon-theme \
  seahorse \
  gwenview \
  kitty || {
  echo "Error: Failed to install packages. Exiting."
  exit 1
}

# Packages sorted from most fundamental to least fundamental
paru -S --noconfirm \
  libastal-meta \
  wbg \
  zen-browser-bin \
  helium-browser-bin \
  qt5ct-kde \
  qt6ct-kde || {
  echo "Error: Failed to install packages. Exiting."
  exit 1
}

echo "Packages installed successfully."

# echo "Stowing fish configuration from dotfiles..."
# cd "$DOTFILES_DIR" || {
#   echo "Error: Could not change directory to $DOTFILES_DIR. Exiting."
#   exit 1
# }
# stow --no-folding fish || {
#   echo "Error: Failed to stow fish configuration. Check if 'fish' directory exists in your dotfiles. Exiting."
#   exit 1
# }
# cd $HOME >/dev/null # Go back to home directory
# echo "Fish configuration stowed successfully."

# chsh -s (which fish)

# Install fisher
# curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher

# Plugins
# fisher install jorgebucaran/hydro
# fisher install jethrokuan/z
# fisher install jorgebucaran/nvm.fish
# fisher install jorgebucaran/autopair.fish
