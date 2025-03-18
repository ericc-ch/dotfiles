function update-eos --description 'alias update eos-update --yay'
  yes | eos-update --yay
  sudo pacman -Qdtq | sudo pacman -Rns --noconfirm -

  flatpak update -y
  flatpak uninstall --unused
end
