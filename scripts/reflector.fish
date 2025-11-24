#!/usr/bin/env fish

sudo reflector \
    --country ID,SG,AU,JP,CN,US \
    --protocol https \
    --sort rate \
    --save /etc/pacman.d/mirrorlist
