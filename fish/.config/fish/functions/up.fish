function up --description 'update system'
    argparse 's/system' 'f/flatpak' -- $argv
    or return 1

    set -l run_all 0
    if not set -q _flag_system; and not set -q _flag_flatpak
        set run_all 1
    end

    if test $run_all -eq 1; or set -q _flag_system
        paru -Syu --noconfirm
        paru -c --noconfirm
    end

    if test $run_all -eq 1; or set -q _flag_flatpak
        flatpak update -y
        flatpak uninstall --unused -y
    end
end
