#!/bin/bash

# --- Script to setup an Arch-based system with dotfiles and fish ---

set -e # Exit immediately if a command exits with a non-zero status.

DOTFILES_DIR="$HOME/dotfiles"

echo "Installing stow..."
sudo pacman -S --noconfirm stow || {
  echo "Error: Failed to install stow. Exiting."
  exit 1
}
echo "stow installed successfully."

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

echo "Installing fisher package manager for fish..."
curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher || {
  echo "Error: Failed to install fisher. Exiting."
  exit 1
}
echo "fisher installed successfully."

echo "Installing fisher plugins..."
fisher install jorgebucaran/hydro
fisher install jethrokuan/z
fisher install jorgebucaran/nvm.fish
fisher install jorgebucaran/autopair.fish
echo "fisher plugins installed successfully."

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
