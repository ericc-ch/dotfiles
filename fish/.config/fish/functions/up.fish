function up --description 'update system'
    argparse 's/system' 'f/flatpak' 'b/bun' -- $argv
    or return 1

    # If no flags, run all
    set -l run_all
    if not set -q _flag_system; and not set -q _flag_flatpak; and not set -q _flag_bun
        set run_all 1
    end

    if set -q run_all; or set -q _flag_system
        paru -Syu --noconfirm
        paru -c --noconfirm
    end

    if set -q run_all; or set -q _flag_flatpak
        flatpak update -y
        flatpak uninstall --unused -y
    end

    if set -q run_all; or set -q _flag_bun
        bun update -g
    end
end
