set -g fish_greeting

# bun
if not contains "$HOME/.bun/bin" $PATH
    set --export BUN_INSTALL "$HOME/.bun"
    set --export PATH $BUN_INSTALL/bin $PATH
end

# flyctl
if not contains "$HOME/.fly/bin" $PATH
    set --export FLYCTL_INSTALL "$HOME/.fly"
    set --export PATH $FLYCTL_INSTALL/bin $PATH
end

# go
if not contains /usr/local/go/bin $PATH
    set --export PATH /usr/local/go/bin $PATH
end

# put random binaries here
if not contains "$HOME/.local/bin" $PATH
    set --export PATH $HOME/.local/bin $PATH
end

# pyenv
if has_command pyenv
    pyenv init - fish | source
end

# aider
set AIDER_KEYS_FILE "$HOME/.config/aider/aider-keys.fish"

if test -f $AIDER_KEYS_FILE
    source $AIDER_KEYS_FILE
end
