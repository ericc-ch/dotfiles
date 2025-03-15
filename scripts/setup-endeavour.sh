#!/bin/bash

# --- Script to setup an Arch-based system with dotfiles and fish ---

set -e # Exit immediately if a command exits with a non-zero status.

DOTFILES_REPO="https://github.com/ericc-ch/dotfiles.git"
DOTFILES_DIR="$HOME/dotfiles"

# Use home dir as working directory
cd $HOME

echo "Creating ~/.local/share/bin directory if it doesn't exist..."
mkdir -p ~/.local/share/bin
if [ $? -ne 0 ]; then
  echo "Error: Failed to create ~/.local/share/bin directory. Exiting."
  exit 1
fi
echo "~/.local/share/bin directory created or already exists."

echo "Cloning dotfiles repository from $DOTFILES_REPO to $DOTFILES_DIR..."
if [ -d "$DOTFILES_DIR" ]; then
  echo "Warning: $DOTFILES_DIR already exists. Skipping cloning."
else
  git clone "$DOTFILES_REPO" "$DOTFILES_DIR"
  if [ $? -ne 0 ]; then
    echo "Error: Failed to clone dotfiles repository. Exiting."
    exit 1
  fi
  echo "Dotfiles repository cloned successfully."
fi

echo "Installing stow..."
sudo pacman -S --noconfirm stow
if [ $? -ne 0 ]; then
  echo "Error: Failed to install additional packages using pacman. Exiting."
  exit 1
fi
echo "stow installed successfully."

echo "Stowing fish configuration from dotfiles..."
if ! command -v stow &>/dev/null; then
  echo "Error: stow is not installed. Please install stow first (e.g., sudo pacman -S stow). Exiting."
  exit 1
fi

cd "$DOTFILES_DIR" || {
  echo "Error: Could not change directory to $DOTFILES_DIR. Exiting."
  exit 1
}
stow --no-folding fish
if [ $? -ne 0 ]; then
  echo "Error: Failed to stow fish configuration. Check if 'fish' directory exists in your dotfiles and stow is configured correctly. Exiting."
  exit 1
fi
cd $HOME >/dev/null # Go back to home directory
echo "Fish configuration stowed successfully."

echo "Installing additional packages..."
sudo pacman -S --noconfirm stow lazygit superfile brightnessctl fish ly uwsm
if [ $? -ne 0 ]; then
  echo "Error: Failed to install additional packages using pacman. Exiting."
  exit 1
fi

yay -S aylurs-gtk-shell-git libastal-meta
if [ $? -ne 0 ]; then
  echo "Error: Failed to install additional packages using yay. Exiting."
  exit 1
fi
echo "Additional packages installed successfully."

echo "Installing fisher package manager for fish..."
curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher
if [ $? -ne 0 ]; then
  echo "Error: Failed to install fisher. Exiting."
  exit 1
fi
echo "fisher installed successfully."

echo "Installing fisher plugins..."
fisher install jorgebucaran/hydro
fisher install jethrokuan/z
fisher install jorgebucaran/nvm.fish
fisher install jorgebucaran/autopair.fish
echo "fisher plugins installed successfully."

echo "Enabling and starting ly service..."
sudo systemctl enable ly.service
if [ $? -ne 0 ]; then
  echo "Error: Failed to enable ly service. Exiting."
  exit 1
fi
echo "ly service enabled and started successfully."

echo "Setting fish as default shell..."
if ! which fish >/dev/null; then
  echo "Error: fish executable not found in PATH. Installation might have failed. Exiting."
  exit 1
fi
chsh -s "$(which fish)"
if [ $? -ne 0 ]; then
  echo "Error: Failed to set fish as default shell. You might need to manually change your shell using 'chsh -s /usr/bin/fish' (or the correct path to fish). Exiting."
  exit 1
fi
echo "Fish shell set as default shell successfully."
