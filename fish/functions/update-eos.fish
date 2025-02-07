function update --description 'alias update eos-update --yay'
  yes | eos-update --yay
  flatpak update -y
end
