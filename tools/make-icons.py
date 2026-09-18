#!/usr/bin/env python3
"""Generate the Reckoner app icons.

A die face showing six — the critical result the whole calculator hinges on —
in brass on gunmetal. Run from the repo root:  python3 tools/make-icons.py
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "www", "icons")
os.makedirs(OUT, exist_ok=True)

GUNMETAL = (23, 27, 30, 255)
BRASS = (216, 165, 72, 255)
FACE = (36, 43, 50, 255)
EDGE = (74, 86, 96, 255)


def draw_icon(size, pad_ratio=0.0, square=False):
    """pad_ratio shrinks the artwork for maskable icons; square skips the rounded corners."""
    ss = 4  # supersample for clean edges
    s = size * ss
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # background tile
    if square:
        d.rectangle([0, 0, s, s], fill=GUNMETAL)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=GUNMETAL)

    # die face, inset by the maskable safe-zone padding when asked for
    inset = s * (0.18 + pad_ratio)
    box = [inset, inset, s - inset, s - inset]
    r = int((box[2] - box[0]) * 0.17)
    d.rounded_rectangle(box, radius=r, fill=FACE, outline=EDGE, width=max(1, int(s * 0.009)))

    # six pips, two columns of three
    w = box[2] - box[0]
    pip = w * 0.088
    cx1 = box[0] + w * 0.31
    cx2 = box[0] + w * 0.69
    ys = [box[1] + w * 0.25, box[1] + w * 0.50, box[1] + w * 0.75]
    for cx in (cx1, cx2):
        for cy in ys:
            d.ellipse([cx - pip, cy - pip, cx + pip, cy + pip], fill=BRASS)

    return img.resize((size, size), Image.LANCZOS)


targets = [
    ("icon-192.png", 192, 0.0, False),
    ("icon-512.png", 512, 0.0, False),
    ("icon-maskable-512.png", 512, 0.07, True),   # full bleed + safe zone for Android masks
    ("apple-touch-icon.png", 180, 0.0, True),      # iOS applies its own corner radius
]

for name, size, pad, square in targets:
    draw_icon(size, pad, square).save(os.path.join(OUT, name))
    print("wrote", name, f"{size}x{size}")

# Matching favicon, as vector so it stays crisp in a browser tab
svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#171b1e"/>
  <rect x="11.5" y="11.5" width="41" height="41" rx="7" fill="#242b32" stroke="#4a5660" stroke-width="1.5"/>
  <g fill="#d8a548">
    <circle cx="24" cy="22" r="3.9"/><circle cx="40" cy="22" r="3.9"/>
    <circle cx="24" cy="32" r="3.9"/><circle cx="40" cy="32" r="3.9"/>
    <circle cx="24" cy="42" r="3.9"/><circle cx="40" cy="42" r="3.9"/>
  </g>
</svg>
"""
with open(os.path.join(OUT, "favicon.svg"), "w") as f:
    f.write(svg)
print("wrote favicon.svg")
