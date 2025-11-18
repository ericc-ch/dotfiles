set -g fish_greeting
set --export MAKEFLAGS -j 4

# ssh agent
set -x SSH_AUTH_SOCK "$XDG_RUNTIME_DIR/ssh-agent.socket"

# Add tool directories to PATH
fish_add_path --append --path \
    $HOME/.bun/bin \
    $HOME/.fly/bin \
    $HOME/go/bin \
    $HOME/.local/bin \
    $HOME/.local/share/pnpm \
    /usr/local/go/bin

# deno
if test -f "$HOME/.deno/env.fish"
    source "$HOME/.deno/env.fish"
end

# cargo
if test -f "$HOME/.cargo/env.fish"
    source "$HOME/.cargo/env.fish"
end
