#!/usr/bin/env fish

sudo reflector \
    --country ID,SG,JP,CN \
    --protocol https \
    --sort rate \
    --save /etc/pacman.d/mirrorlist
