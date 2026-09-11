#!/usr/bin/env python3
"""
Validate a soul-link-desktop sprite directory before wiring it into the app.

The animation engine draws every frame into the same canvas rect, so frames that
disagree on size or on where the character sits make the desk pet visibly jitter.
Catching that here is much cheaper than noticing it in a packaged build.

Checks
------
  1. manifest.json parses; every frame it references exists
  2. files present but not referenced by the manifest
  3. all frames share one canvas size
  4. frames are RGBA and actually carry transparency
  5. content does not touch the canvas edge (a sign of clipping)
  6. anchor drift: bottom-centre of each frame's content vs the median,
     both across the whole set and within each animation

Usage
-----
  python tools/sprite_check.py res/sprites/baiyuan
  python tools/sprite_check.py res/sprites/baiyuan --max-drift 6 --json

Exit code 0 when clean, 1 when any error is found (warnings alone still pass),
so it can gate a build step.

Requires Pillow:  pip install Pillow
"""

import argparse
import json
import statistics
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

ERRORS = []
WARNINGS = []


def err(msg):
    ERRORS.append(msg)


def warn(msg):
    WARNINGS.append(msg)


def load_manifest(root):
    path = root / "manifest.json"
    if not path.exists():
        err(f"{path} not found")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        err(f"{path} is not valid JSON: {exc}")
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sprite_dir", help="e.g. res/sprites/baiyuan")
    ap.add_argument("--frames-dir", default="frames")
    ap.add_argument("--max-drift", type=int, default=4,
                    help="allowed bottom-centre drift in px (default 4)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    root = Path(args.sprite_dir)
    frames_dir = root / args.frames_dir
    manifest = load_manifest(root)
    if manifest is None:
        report({}, args)
        return

    animations = manifest.get("animations", {})
    referenced = []
    for anim, spec in animations.items():
        for fname in spec.get("frames", []):
            referenced.append((anim, fname))

    if not referenced:
        err("manifest declares no frames")

    missing = [f for _, f in referenced if not (frames_dir / f).exists()]
    if missing:
        err(f"{len(missing)} frame(s) referenced by the manifest are missing: "
            + ", ".join(missing[:8]) + (" ..." if len(missing) > 8 else ""))

    on_disk = {p.name for p in frames_dir.glob("*.png")} if frames_dir.exists() else set()
    if not frames_dir.exists():
        err(f"{frames_dir} does not exist")
    elif not on_disk:
        err(f"{frames_dir} contains no .png files")

    extra = sorted(on_disk - {f for _, f in referenced})
    if extra:
        warn(f"{len(extra)} file(s) on disk are not referenced by the manifest: "
             + ", ".join(extra[:8]) + (" ..." if len(extra) > 8 else ""))

    info = {}
    for anim, fname in referenced:
        path = frames_dir / fname
        if not path.exists():
            continue
        img = Image.open(path)
        if img.mode != "RGBA":
            warn(f"{fname}: mode is {img.mode}, expected RGBA")
            img = img.convert("RGBA")
        alpha = img.getchannel("A")
        box = img.getbbox()
        if box is None:
            err(f"{fname}: fully transparent")
            continue
        info[fname] = {
            "animation": anim,
            "canvas": img.size,
            "box": box,
            "opaque": alpha.getextrema()[0] == 255,
            "bottom_centre": ((box[0] + box[2]) // 2, box[3]),
        }

    if not info:
        report({}, args)
        return

    sizes = {v["canvas"] for v in info.values()}
    if len(sizes) > 1:
        err("frames disagree on canvas size: " + ", ".join(f"{w}x{h}" for w, h in sorted(sizes)))

    opaque = [f for f, v in info.items() if v["opaque"]]
    if len(opaque) == len(info):
        err("no frame has any transparency — the background was never removed")
    elif opaque:
        warn(f"{len(opaque)} frame(s) have no transparent pixel: " + ", ".join(opaque[:6]))

    for fname, v in info.items():
        cw, ch = v["canvas"]
        x0, y0, x1, y1 = v["box"]
        if x0 == 0 or y0 == 0 or x1 == cw or y1 == ch:
            warn(f"{fname}: content touches the canvas edge — may be clipped")

    xs = [v["bottom_centre"][0] for v in info.values()]
    ys = [v["bottom_centre"][1] for v in info.values()]
    mx, my = int(statistics.median(xs)), int(statistics.median(ys))
    for fname, v in info.items():
        bx, by = v["bottom_centre"]
        drift = max(abs(bx - mx), abs(by - my))
        v["drift"] = drift
        if drift > args.max_drift:
            err(f"{fname}: bottom-centre ({bx},{by}) drifts {drift}px from the median "
                f"({mx},{my}) — the pet will jitter")

    for anim in animations:
        members = {f: v for f, v in info.items() if v["animation"] == anim}
        if len(members) < 2:
            continue
        axs = [v["bottom_centre"][0] for v in members.values()]
        ays = [v["bottom_centre"][1] for v in members.values()]
        spread = max(max(axs) - min(axs), max(ays) - min(ays))
        if spread > args.max_drift:
            warn(f"animation {anim!r}: bottom-centre spread {spread}px across its own frames")

    report(info, args, (mx, my))


def report(info, args, median=None):
    if args.json:
        print(json.dumps({
            "frames": {f: {k: v for k, v in d.items() if k != "animation"} | {"animation": d["animation"]}
                       for f, d in info.items()},
            "median_bottom_centre": median,
            "errors": ERRORS,
            "warnings": WARNINGS,
        }, indent=2, default=list))
    else:
        if info:
            w = max(len(f) for f in info)
            print(f"{'frame'.ljust(w)}  {'canvas':>11}  {'content':>11}  {'bottom-centre':>14}  drift")
            for fname in sorted(info):
                d = info[fname]
                cw, ch = d["canvas"]
                x0, y0, x1, y1 = d["box"]
                bx, by = d["bottom_centre"]
                print(f"{fname.ljust(w)}  {f'{cw}x{ch}':>11}  {f'{x1 - x0}x{y1 - y0}':>11}  "
                      f"{f'({bx},{by})':>14}  {d.get('drift', '-')}")
            if median:
                print(f"\nmedian bottom-centre ({median[0]},{median[1]}), tolerance {args.max_drift}px")
            print()
        for m in WARNINGS:
            print(f"  warning  {m}")
        for m in ERRORS:
            print(f"  ERROR    {m}")
        if not ERRORS and not WARNINGS:
            print("clean — no errors, no warnings")
        elif not ERRORS:
            print(f"\npassed with {len(WARNINGS)} warning(s)")
        else:
            print(f"\nFAILED: {len(ERRORS)} error(s), {len(WARNINGS)} warning(s)")

    sys.exit(1 if ERRORS else 0)


if __name__ == "__main__":
    main()
