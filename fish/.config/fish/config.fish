set -g fish_greeting

# XDG base directories
set -q XDG_CONFIG_HOME || set -gx XDG_CONFIG_HOME $HOME/.config
set -q XDG_DATA_HOME || set -gx XDG_DATA_HOME $HOME/.local/share
set -q XDG_CACHE_HOME || set -gx XDG_CACHE_HOME $HOME/.cache
set -q XDG_STATE_HOME || set -gx XDG_STATE_HOME $HOME/.local/state

# makefile
set -gx MAKEFLAGS -j(nproc)
# ssh agent
set -gx SSH_AUTH_SOCK "$XDG_RUNTIME_DIR/ssh-agent.socket"
# pnpm
set -gx PNPM_HOME "$HOME/.local/share/pnpm"
# opencode
set -gx OPENCODE_EXPERIMENTAL true
# XDG_DATA_DIRS - ensure base dirs exist (display managers may already set this)
if not set -q XDG_DATA_DIRS
    set -gx XDG_DATA_DIRS /usr/local/share /usr/share
else
    # Add base dirs if missing (prepend so DM's additions stay at end)
    for dir in /usr/share /usr/local/share
        if not contains $dir $XDG_DATA_DIRS
            set -gx --prepend XDG_DATA_DIRS $dir
        end
    end
end

# flatpak
for dir in /var/lib/flatpak/exports/share $HOME/.local/share/flatpak/exports/share
    if not contains $dir $XDG_DATA_DIRS
        set -gx --prepend XDG_DATA_DIRS $dir
    end
end

# Add tool directories to PATH (highest priority first)
fish_add_path \
    $HOME/.local/bin \
    $HOME/.bun/bin \
    $XDG_CACHE_HOME/.bun/bin \
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

# ASDF
if test -z $ASDF_DATA_DIR
    set _asdf_shims "$HOME/.asdf/shims"
else
    set _asdf_shims "$ASDF_DATA_DIR/shims"
end

if not contains $_asdf_shims $PATH
    set -gx --prepend PATH $_asdf_shims
end
set --erase _asdf_shims

# Load any local overrides or secrets (ignored by git)
for file in $__fish_config_dir/*local.fish
    if test -f "$file"
        source "$file"
    end
end

# zoxide: loaded from conf.d/zoxide.fish (cached for faster startup)
