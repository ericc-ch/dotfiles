function up --description 'update system'
    paru -Syu
    paru -c

    flatpak update -y
    flatpak uninstall --unused
end
