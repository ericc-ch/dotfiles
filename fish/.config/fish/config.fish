set -g fish_greeting

# bun
set --export BUN_INSTALL "$HOME/.bun"
set --export PATH $BUN_INSTALL/bin $PATH

# put random binaries here
set --export PATH $HOME/.local/bin $PATH

# go
set --export PATH /usr/local/go/bin $PATH
