set -g fish_greeting

set --export MAKEFLAGS -j 4

# ssh agent
set -x SSH_AUTH_SOCK "$XDG_RUNTIME_DIR/ssh-agent.socket"

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

# "go install" binaries
if not contains $HOME/go/bin $PATH
    set --export PATH $HOME/go/bin $PATH
end

# put random binaries here
if not contains "$HOME/.local/bin" $PATH
    set --export PATH $HOME/.local/bin $PATH
end

# deno
if test -f "$HOME/.deno/env.fish"
    source "$HOME/.deno/env.fish"
end

if test -f "$HOME/.cargo/env.fish"
    source "$HOME/.cargo/env.fish"
end

# pnpm
if not contains "$HOME/.local/share/pnpm" $PATH
    set --export PNPM_HOME "$HOME/.local/share/pnpm"
    set --export PATH $PNPM_HOME $PATH
end
