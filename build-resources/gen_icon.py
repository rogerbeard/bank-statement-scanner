#!/usr/bin/env python3
"""Generate a Bank Statement Scanner app icon (blueprint aesthetic)."""
from PIL import Image, ImageDraw, ImageFont
import os, math

SIZE = 1024
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background rounded rect
R = 180
bg_color = (10, 22, 40, 255)
draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=R, fill=bg_color)

# Blueprint grid
grid_color = (74, 144, 217, 20)
for x in range(0, SIZE, 64):
    draw.line([(x, 0), (x, SIZE)], fill=grid_color, width=1)
for y in range(0, SIZE, 64):
    draw.line([(0, y), (SIZE, y)], fill=grid_color, width=1)

# Accent border
border_color = (74, 144, 217, 180)
draw.rounded_rectangle([16, 16, SIZE-16, SIZE-16], radius=R-10, outline=border_color, width=4)

# Corner marks
cm = 60; ct = 4; co = 48
corner_color = (74, 144, 217, 220)
for cx, cy, dx, dy in [(co, co, 1, 1), (SIZE-co, co, -1, 1), (co, SIZE-co, 1, -1), (SIZE-co, SIZE-co, -1, -1)]:
    draw.line([(cx, cy), (cx + dx*cm, cy)], fill=corner_color, width=ct)
    draw.line([(cx, cy), (cx, cy + dy*cm)], fill=corner_color, width=ct)

# Document icon body
doc_x1, doc_y1 = 240, 200
doc_x2, doc_y2 = 680, 780
fold = 100
doc_color = (30, 58, 95, 255)
doc_border = (74, 144, 217, 255)

# Document shape with folded corner
poly = [
    (doc_x1, doc_y1),
    (doc_x2 - fold, doc_y1),
    (doc_x2, doc_y1 + fold),
    (doc_x2, doc_y2),
    (doc_x1, doc_y2),
]
draw.polygon(poly, fill=doc_color)
draw.polygon(poly, outline=doc_border, width=5)

# Folded corner triangle
fold_poly = [(doc_x2 - fold, doc_y1), (doc_x2, doc_y1 + fold), (doc_x2 - fold, doc_y1 + fold)]
draw.polygon(fold_poly, fill=(20, 40, 70, 255))
draw.polygon(fold_poly, outline=doc_border, width=3)

# Table lines (transaction rows)
line_color = (74, 144, 217, 160)
line_w = 3
# Header line
draw.line([(doc_x1+40, doc_y1+140), (doc_x2-40, doc_y1+140)], fill=(0, 229, 160, 200), width=4)
# Row lines
for i in range(1, 6):
    y = doc_y1 + 140 + i * 90
    if y < doc_y2 - 40:
        draw.line([(doc_x1+40, y), (doc_x2-40, y)], fill=line_color, width=line_w)

# Column dividers
col_x = [doc_x1+40, doc_x1+160, doc_x1+380, doc_x1+500]
for cx in col_x:
    if cx < doc_x2 - 40:
        draw.line([(cx, doc_y1+100), (cx, doc_y2-40)], fill=line_color, width=2)

# Accent dot (green)
draw.ellipse([doc_x2-60, doc_y1+20, doc_x2-20, doc_y1+60], fill=(0, 229, 160, 255))

out = os.path.join(os.path.dirname(__file__), 'icon.png')
img.save(out, 'PNG')
print(f'Icon saved: {out} ({SIZE}x{SIZE})')
