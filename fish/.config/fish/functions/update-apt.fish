function update-apt --description 'Update all installed packages'
    # Update apt packages
    sudo apt update
    sudo apt upgrade -y
    sudo apt autoremove -y

    # Update flatpak packages
    flatpak update -y
    flatpak uninstall --unused
end
