set -g fish_greeting

# XDG base directories
set -q XDG_CONFIG_HOME || set -gx XDG_CONFIG_HOME $HOME/.config
set -q XDG_DATA_HOME || set -gx XDG_DATA_HOME $HOME/.local/share
set -q XDG_CACHE_HOME || set -gx XDG_CACHE_HOME $HOME/.cache

# makefile
set -gx MAKEFLAGS -j(nproc)
# ssh agent
set -gx SSH_AUTH_SOCK "$XDG_RUNTIME_DIR/ssh-agent.socket"
# flatpak
for dir in /var/lib/flatpak/exports/share $HOME/.local/share/flatpak/exports/share
    if not contains $dir $XDG_DATA_DIRS
        set -gx XDG_DATA_DIRS $XDG_DATA_DIRS $dir
    end
end
# pnpm
set -gx PNPM_HOME "$HOME/.local/share/pnpm"

# Add tool directories to PATH (highest priority first)
fish_add_path \
    $HOME/.local/bin \
    $HOME/.bun/bin \
    $HOME/go/bin \
    $PNPM_HOME \
    $HOME/.fly/bin \
    /usr/local/go/bin

# deno
if test -f "$HOME/.deno/env.fish"
    source "$HOME/.deno/env.fish"
end

# cargo
if test -f "$HOME/.cargo/env.fish"
    source "$HOME/.cargo/env.fish"
end
