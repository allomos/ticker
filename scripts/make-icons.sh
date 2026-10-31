#!/bin/sh
# Rebuilds the home-screen icons (PNG) from public/icons/icon.svg and maskable.svg.
# To change the icon, edit those two SVGs (and public/favicon.svg), then run: sh scripts/make-icons.sh
# Needs rsvg-convert (Homebrew: brew install librsvg).
set -e
cd "$(dirname "$0")/../public/icons"
rsvg-convert -w 180 -h 180 icon.svg -o apple-touch-icon.png
rsvg-convert -w 192 -h 192 icon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 icon.svg -o icon-512.png
rsvg-convert -w 512 -h 512 maskable.svg -o maskable-512.png
echo "Icons written to public/icons/"
