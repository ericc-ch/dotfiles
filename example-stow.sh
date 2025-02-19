#!/bin/bash

# This is a reference file demonstrating different ways to use GNU Stow
# This is not meant to be executed

# Basic usage (when your stow directory is ~/dotfiles):
# stow fish        # Creates symlinks in parent directory of stow dir
# stow aider       # Same as above
# stow llm         # Same as above

# When your stow directory is not in the default location:
# stow -t ~ fish   # Explicitly specify target directory as home
# stow -t ~ aider  # Same as above
# stow -t ~ llm    # Same as above

# Useful options:
# -n    Dry run - show what would happen without making changes
# -v    Verbose - show all actions
# -D    Delete/Uninstall - remove symlinks
# -R    Restow - remove and then re-create symlinks

# Examples with options:
# stow -v fish            # Verbose output
# stow -nv fish          # Dry run with verbose output
# stow -D fish           # Delete fish symlinks
# stow -R fish           # Restow fish symlinks
