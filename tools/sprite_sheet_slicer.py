#!/usr/bin/env python3
"""
Slice a generated sprite sheet into soul-link-desktop animation frames.

Why a sheet: generating all poses in ONE image keeps the character, style and
lighting consistent (same latent), which text-to-image cannot guarantee across
separate runs. Slice afterwards.

Why a SHARED crop: every frame is cropped by the *same* rectangle (the union of
all frames' content), never by its own bounding box. Per-frame trimming destroys
relative motion and makes the pet visibly jitter between frames.

Usage
-----
  # names taken from an existing manifest (recommended)
  python tools/sprite_sheet_slicer.py sheet.png --grid 3x4 \
      --manifest res/sprites/baiyuan/manifest.json \
      --only idle,talk,happy \
      -o res/sprites/baiyuan/frames

  # explicit names
  python tools/sprite_sheet_slicer.py sheet.png --grid 2x4 \
      --names idle:3 talk:3 happy:2 -o out/

Options
-------
  --grid RxC        rows x cols of the sheet (required)
  --manifest PATH   read frame names from a manifest.json
  --only A,B,C      with --manifest: only these animations, in this order
  --names N:C ...   explicit "animation:framecount" pairs, in sheet order
  --bg MODE         auto (flood fill from cell border) | none | #RRGGBB
  --tolerance N     max per-channel colour difference from the backdrop (default 28)
  --size WxH        final canvas; default = union content box + padding
  --pad N           padding around the union content box (default 8)
  --dry-run         report only, write nothing

Requires Pillow:  pip install Pillow
"""

import argparse
import json
import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")


def parse_grid(text):
    try:
        rows, cols = (int(p) for p in text.lower().split("x"))
        if rows < 1 or cols < 1:
            raise ValueError
        return rows, cols
    except Exception:
        raise argparse.ArgumentTypeError("--grid must look like 3x4")


def parse_size(text):
    try:
        w, h = (int(p) for p in text.lower().split("x"))
        return w, h
    except Exception:
        raise argparse.ArgumentTypeError("--size must look like 512x512")


def hex_to_rgb(text):
    t = text.lstrip("#")
    if len(t) != 6:
        raise argparse.ArgumentTypeError("--bg colour must look like #RRGGBB")
    return tuple(int(t[i:i + 2], 16) for i in (0, 2, 4))


def frame_names(args):
    """Return a flat list of output file stems, in sheet order."""
    if args.names:
        pairs = []
        for item in args.names:
            name, _, count = item.partition(":")
            if not count.isdigit():
                sys.exit(f"--names entry {item!r} must look like idle:3")
            pairs.append((name, int(count)))
    elif args.manifest:
        data = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
        anims = data.get("animations", {})
        wanted = [a.strip() for a in args.only.split(",")] if args.only else list(anims)
        pairs = []
        for name in wanted:
            if name not in anims:
                sys.exit(f"animation {name!r} is not in {args.manifest}")
            pairs.append((name, len(anims[name]["frames"])))
    else:
        sys.exit("give either --manifest or --names")

    out = []
    for name, count in pairs:
        out.extend(f"{name}_{i:03d}" for i in range(1, count + 1))
    return out, pairs


def strip_background(img, tolerance, forced_rgb=None):
    """Flood fill transparency inward from the border.

    Border-connected only, so a white shirt in the middle of the character does
    not get punched out the way a plain colour-distance threshold would.
    """
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    if forced_rgb is not None:
        seed = forced_rgb
    else:
        corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
        seed = tuple(sum(c[i] for c in corners) // 4 for i in range(3))

    def close(p):
        # max per-channel difference, not the sum: the sum triples the effective
        # tolerance and happily eats skin tones that sit near a light backdrop
        return max(abs(p[0] - seed[0]), abs(p[1] - seed[1]), abs(p[2] - seed[2])) <= tolerance

    seen = bytearray(w * h)
    removed = [0]
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        idx = y * w + x
        if seen[idx]:
            continue
        seen[idx] = 1
        if not close(px[x, y]):
            continue
        px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        removed[0] += 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                queue.append((nx, ny))
    return img, removed[0] / float(w * h)


def union_box(frames):
    boxes = [f.getbbox() for f in frames]
    if any(b is None for b in boxes):
        sys.exit("at least one cell is fully transparent — check --grid or --tolerance")
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet")
    ap.add_argument("--grid", type=parse_grid, required=True)
    ap.add_argument("--manifest")
    ap.add_argument("--only")
    ap.add_argument("--names", nargs="+")
    ap.add_argument("-o", "--out", default=".")
    ap.add_argument("--bg", default="auto")
    ap.add_argument("--tolerance", type=int, default=28)
    ap.add_argument("--size", type=parse_size)
    ap.add_argument("--pad", type=int, default=8)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows, cols = args.grid
    names, pairs = frame_names(args)
    cells = rows * cols
    if len(names) > cells:
        sys.exit(f"{len(names)} frame names but the grid only holds {cells} cells")

    sheet = Image.open(args.sheet).convert("RGBA")
    sw, sh = sheet.size
    if sw % cols or sh % rows:
        print(f"  warning: sheet {sw}x{sh} does not divide evenly into {rows}x{cols}; "
              f"cells will be {sw // cols}x{sh // rows} and edges may be cropped")
    cw, ch = sw // cols, sh // rows

    forced = None if args.bg in ("auto", "none") else hex_to_rgb(args.bg)

    frames = []
    for i in range(len(names)):
        r, c = divmod(i, cols)
        cell = sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        if args.bg != "none":
            cell, share = strip_background(cell, args.tolerance, forced)
            if share > 0.90:
                print(f"  warning: cell {i + 1} lost {share:.0%} of its pixels — the character's "
                      f"colours may be within --tolerance {args.tolerance} of the backdrop; "
                      f"try a lower tolerance or --bg none")
            elif share < 0.02:
                print(f"  warning: cell {i + 1} lost only {share:.1%} — background not detected; "
                      f"try a higher --tolerance or --bg '#RRGGBB'")
        frames.append(cell)

    ux0, uy0, ux1, uy1 = union_box(frames)
    ux0 = max(0, ux0 - args.pad)
    uy0 = max(0, uy0 - args.pad)
    ux1 = min(cw, ux1 + args.pad)
    uy1 = min(ch, uy1 + args.pad)
    crop_w, crop_h = ux1 - ux0, uy1 - uy0

    if args.size:
        out_w, out_h = args.size
        if crop_w > out_w or crop_h > out_h:
            sys.exit(f"content is {crop_w}x{crop_h}, larger than --size {out_w}x{out_h}")
    else:
        out_w, out_h = crop_w, crop_h

    # keep the character's feet on the canvas floor: centre horizontally,
    # bottom-align vertically, identically for every frame
    dx = (out_w - crop_w) // 2
    dy = out_h - crop_h

    outdir = Path(args.out)
    print(f"sheet     {args.sheet}  {sw}x{sh}   cell {cw}x{ch}   grid {rows}x{cols}")
    print(f"content   union box {crop_w}x{crop_h} at ({ux0},{uy0})  ->  canvas {out_w}x{out_h}")
    print(f"animations {', '.join(f'{n}x{c}' for n, c in pairs)}")
    print(f"output    {outdir}/{'  (dry run)' if args.dry_run else ''}")
    print()

    if not args.dry_run:
        outdir.mkdir(parents=True, exist_ok=True)

    for name, frame in zip(names, frames):
        canvas = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
        canvas.paste(frame.crop((ux0, uy0, ux1, uy1)), (dx, dy))
        box = canvas.getbbox()
        path = outdir / f"{name}.png"
        if not args.dry_run:
            canvas.save(path)
        print(f"  {name}.png   content {box[2] - box[0]}x{box[3] - box[1]}  bottom-centre "
              f"({(box[0] + box[2]) // 2},{box[3]})")

    print()
    print("next:  python tools/sprite_check.py <sprite dir>")


if __name__ == "__main__":
    main()
