#!/bin/bash

# --- Script to setup an Arch-based system with dotfiles and fish ---

set -e # Exit immediately if a command exits with a non-zero status.

DOTFILES_DIR="$HOME/dotfiles"

echo "Installing required packages..."
sudo pacman -S --noconfirm \
  stow \
  niri \
  ly \
  ghostty \
  xwayland-satellite \
  qt5-wayland \
  qt5ct \
  qt6ct \
  kvantum || {
  echo "Error: Failed to install packages. Exiting."
  exit 1
}
echo "Packages installed successfully."

echo "Stowing fish configuration from dotfiles..."
cd "$DOTFILES_DIR" || {
  echo "Error: Could not change directory to $DOTFILES_DIR. Exiting."
  exit 1
}
stow --no-folding fish || {
  echo "Error: Failed to stow fish configuration. Check if 'fish' directory exists in your dotfiles. Exiting."
  exit 1
}
cd $HOME >/dev/null # Go back to home directory
echo "Fish configuration stowed successfully."


echo "Setting fish as default shell..."
if ! which fish >/dev/null; then
  echo "Error: fish executable not found in PATH. Installation might have failed. Exiting."
  exit 1
fi
chsh -s "$(which fish)" || {
  echo "Error: Failed to set fish as default shell. You might need to manually run 'chsh -s $(which fish)'. Exiting."
  exit 1
}
echo "Fish shell set as default shell successfully."

# Install fisher
# curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher

# Plugins
# fisher install jorgebucaran/hydro
# fisher install jethrokuan/z
# fisher install jorgebucaran/nvm.fish
# fisher install jorgebucaran/autopair.fish
