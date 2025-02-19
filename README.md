# Dotfiles

Personal dotfiles managed with GNU Stow.

## Installation

Clone this repository and use GNU Stow to create symlinks:

```bash
# Clone to ~/dotfiles (recommended)
git clone https://github.com/ericc-ch/dotfiles.git ~/dotfiles

# Enter the repository
cd ~/dotfiles

# Use GNU Stow to create symlinks
stow aider
stow fish
stow llm
```

⚠️ **Note**: If you clone to a location other than `~/dotfiles`, you must use `-t ~` with stow:

```bash
stow -t ~ aider
```

stow by default uses the parent of the stow directory.

## Usage Examples

The `example-stow.sh` file contains reference documentation showing:

- Basic stow usage patterns
- Common command line options
- Examples with different flags
- Important usage notes

See that file for detailed examples of how to use GNU Stow effectively.
