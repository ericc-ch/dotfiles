function update-eos --description 'alias update eos-update --yay'
    yes | eos-update --yay
    sudo yay -Yc

    flatpak update -y
    flatpak uninstall --unused
end
