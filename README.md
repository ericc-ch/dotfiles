# Dotfiles

Personal dotfiles managed with GNU Stow.

## Installation

Clone this repository and use GNU Stow to create symlinks:

```bash
# Clone to ~/dotfiles (recommended)
git clone https://github.com/ericc-ch/dotfiles.git ~/dotfiles

# Enter the repository
cd ~/dotfiles

# Use GNU Stow to create symlinks for a specific package (e.g., 'fish'):
stow fish

# Or to install all packages at once:
stow *
```

⚠️ **Note**: If you clone to a location other than `~/dotfiles`, you must use `-t ~` with stow:

```bash
stow -t ~ aider
```

`stow` by default uses the parent of the stow directory.

## GNU Stow Usage Guide

Below are reference examples demonstrating different ways to use GNU Stow.

### Basic Usage

Assuming your stow directory is `~/dotfiles` (default behavior uses the parent directory):

```bash
stow fish        # Creates symlinks in parent directory of stow dir
stow ghostty     # Same as above
stow niri        # Same as above
```

### Custom Target Directory

When your stow directory is not in the default location or you want to be explicit:

```bash
stow -t ~ fish     # Explicitly specify target directory as home
stow -t ~ ghostty  # Same as above
stow -t ~ niri     # Same as above
```

### Useful Options

- `-n`: **Dry run** - show what would happen without making changes
- `-v`: **Verbose** - show all actions
- `-D`: **Delete/Uninstall** - remove symlinks
- `-R`: **Restow** - remove and then re-create symlinks
- `--no-folding`: **Don't fold directories** - create individual file symlinks instead of directory symlinks

### Advanced Examples

```bash
stow -v fish                 # Verbose output
stow -nv fish                # Dry run with verbose output
stow -D fish                 # Delete fish symlinks
stow -R fish                 # Restow fish symlinks
stow --no-folding fish       # Create individual file symlinks (useful for .config/ shared across packages)
```

## Troubleshooting & Notes

### Audio Fixes

- Use dell-headset-multi
- Unmute in alsamixer
- Completely shut down. Do not reboot.

### Setting up kwallet with ly

You dont need to do anything mate
just install kwallet-pam

### Why is firefox "show in folder" opening nautilus instead of dolphin?

Because nautilus name matches exactly in that org.freedesktop shit the FileManager1 stuff
