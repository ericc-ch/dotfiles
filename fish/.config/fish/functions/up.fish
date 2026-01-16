function up --description 'update system'
  paru -Syu --noconfirm
  paru -c --noconfirm

  flatpak update -y
  flatpak uninstall --unused -y
end
