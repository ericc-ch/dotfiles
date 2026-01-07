#!/usr/bin/env fish

sudo reflector \
    --country SG,CN,ID,AU \
    --protocol https \
    --sort rate \
    --save /etc/pacman.d/mirrorlist
