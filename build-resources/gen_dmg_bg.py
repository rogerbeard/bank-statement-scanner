#!/usr/bin/env python3
"""Generate DMG background image (blueprint aesthetic, 660x400)."""
from PIL import Image, ImageDraw
import os

W, H = 660, 400
img = Image.new('RGB', (W, H), (10, 22, 40))
draw = ImageDraw.Draw(img)

# Blueprint grid
for x in range(0, W, 32):
    draw.line([(x, 0), (x, H)], fill=(74, 144, 217, 15), width=1)
for y in range(0, H, 32):
    draw.line([(0, y), (W, y)], fill=(74, 144, 217, 15), width=1)

# Border
draw.rectangle([0, 0, W-1, H-1], outline=(74, 144, 217, 80), width=2)

# Corner marks
cm = 24; ct = 2; co = 20
for cx, cy, dx, dy in [(co, co, 1, 1), (W-co, co, -1, 1), (co, H-co, 1, -1), (W-co, H-co, -1, -1)]:
    draw.line([(cx, cy), (cx + dx*cm, cy)], fill=(74, 144, 217, 160), width=ct)
    draw.line([(cx, cy), (cx, cy + dy*cm)], fill=(74, 144, 217, 160), width=ct)

# Title text area (left side, where app icon goes)
draw.text((180, 310), 'BANK STATEMENT SCANNER', fill=(74, 144, 217, 120),
          font=None)  # system font fallback

# Arrow hint
draw.text((330, 180), '→', fill=(74, 144, 217, 80), font=None)

# Applications label
draw.text((460, 310), 'Applications', fill=(74, 144, 217, 80), font=None)

out = os.path.join(os.path.dirname(__file__), 'dmg-background.png')
img.save(out, 'PNG')
print(f'DMG background saved: {out}')
