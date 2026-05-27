#!/usr/bin/env python3
"""Generate PWA icons for Minutes.

Outputs into ./public:
  icon-192.png         (192x192, normal)
  icon-512.png         (512x512, normal)
  icon-512-maskable.png (512x512, with safe-zone padding for adaptive icons)

Re-run any time the brand mark changes.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

INK = (15, 27, 45)
TERRACOTTA = (198, 93, 62)

FONT_CANDIDATES = [
    "/Library/Fonts/IBMPlexSerif-Bold.ttf",
    "/Library/Fonts/IBM Plex Serif Bold.ttf",
    os.path.expanduser("~/Library/Fonts/IBMPlexSerif-Bold.ttf"),
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "/Library/Fonts/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
]


def find_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size), os.path.basename(path)
            except Exception:
                continue
    return ImageFont.load_default(), "default"


def render(size, maskable=False):
    img = Image.new("RGB", (size, size), INK)
    draw = ImageDraw.Draw(img)

    # Maskable icons need a 20% safe zone — Android crops outside it.
    target = size * 0.6 if maskable else size * 0.78
    font_size = int(target)
    font, _ = find_font(font_size)

    text = "m"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    # Compensate for the bbox offset so the glyph is optically centered.
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    draw.text((x, y), text, fill=TERRACOTTA, font=font)
    return img


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
    os.makedirs(out_dir, exist_ok=True)

    files = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-512-maskable.png", 512, True),
    ]
    for name, size, maskable in files:
        path = os.path.join(out_dir, name)
        render(size, maskable=maskable).save(path, "PNG", optimize=True)
        print(f"wrote {path}")


if __name__ == "__main__":
    sys.exit(main())
