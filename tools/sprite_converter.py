#!/usr/bin/env python3
"""
Convert DyberPet act_conf.json to soul-link-desktop manifest.json format.

Usage:
    python sprite_converter.py <act_conf.json> <output_manifest.json>

DyberPet act_conf.json format (approximate):
{
    "actions": {
        "idle": {
            "images": ["act_idle_0.png", "act_idle_1.png", ...],
            "condition": {"prob": 0.5, "hp": 0, ...}
        },
        ...
    },
    "fps": 10
}
"""

import json
import sys
import os
import shutil
from pathlib import Path


def convert(act_conf_path: str, output_path: str, frames_src_dir: str = None, frames_dst_dir: str = None):
    with open(act_conf_path, encoding='utf-8') as f:
        src = json.load(f)

    fps = src.get('fps', 10)
    actions = src.get('actions', {})

    manifest = {
        "character": Path(output_path).parent.name,
        "defaultAnimation": "idle",
        "frameRate": fps,
        "animations": {}
    }

    EMOTION_TRIGGERS = {
        'talk', 'happy', 'intimate', 'concerned', 'sad', 'playful', 'protective', 'cooking'
    }

    for action_name, action_data in actions.items():
        images = action_data.get('images', [])
        condition = action_data.get('condition', {})

        prob = condition.get('prob', 0.1)
        min_fv = condition.get('hp', 0)

        anim_name = action_name.lower()
        is_trigger = any(t in anim_name for t in EMOTION_TRIGGERS - {'talk'})
        is_idle = 'idle' in anim_name or 'stand' in anim_name

        anim_def = {
            "frames": images,
            "loop": is_idle,
            "probability": prob if is_idle else (0 if is_trigger else prob),
            "minFV": int(min_fv)
        }

        if is_trigger:
            anim_def["trigger"] = "on_message"
            anim_def["next"] = "idle"

        manifest["animations"][anim_name] = anim_def

    # Ensure idle exists
    if "idle" not in manifest["animations"]:
        manifest["defaultAnimation"] = next(iter(manifest["animations"]), "idle")

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"Converted {len(manifest['animations'])} animations → {output_path}")

    # Optionally copy frame images
    if frames_src_dir and frames_dst_dir:
        os.makedirs(frames_dst_dir, exist_ok=True)
        for anim in manifest["animations"].values():
            for frame in anim["frames"]:
                src_file = Path(frames_src_dir) / frame
                dst_file = Path(frames_dst_dir) / frame
                if src_file.exists() and not dst_file.exists():
                    shutil.copy2(src_file, dst_file)
        print(f"Copied frames → {frames_dst_dir}")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    act_conf = sys.argv[1]
    output = sys.argv[2]
    frames_src = sys.argv[3] if len(sys.argv) > 3 else None
    frames_dst = sys.argv[4] if len(sys.argv) > 4 else None

    convert(act_conf, output, frames_src, frames_dst)
