#!/usr/bin/env python3
"""Prepare Codex-Kitty sprites for small-screen previews.

The script trims near-white margins from yellow skin state PNGs, adds a small
safe padding, and writes the result to assets/yellow/pet without touching the
source images.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError:
    print("Pillow is required. Install it with: pip install pillow", file=sys.stderr)
    raise SystemExit(1)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "pets" / "codex_kitty" / "assets" / "yellow"
OUTPUT_DIR = SOURCE_DIR / "pet"
STATE_FILES = [
    "idle.png",
    "running.png",
    "waiting.png",
    "done.png",
    "error.png",
    "research.png",
    "break.png",
    "longbreak.png",
]
PADDING = 10
WHITE_THRESHOLD = 245


def content_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    diff = ImageChops.difference(rgba, background)
    grayscale = diff.convert("L")
    mask = grayscale.point(lambda px: 255 if px > 255 - WHITE_THRESHOLD else 0)
    alpha = rgba.getchannel("A").point(lambda px: 255 if px > 10 else 0)
    mask = ImageChops.multiply(mask, alpha)
    return mask.getbbox()


def padded_crop_box(
    bbox: tuple[int, int, int, int],
    size: tuple[int, int],
    padding: int,
) -> tuple[int, int, int, int]:
    left, top, right, bottom = bbox
    width, height = size
    return (
        max(0, left - padding),
        max(0, top - padding),
        min(width, right + padding),
        min(height, bottom + padding),
    )


def process_file(source: Path, destination: Path) -> None:
    image = Image.open(source)
    bbox = content_bbox(image)
    if bbox is None:
        cropped = image.copy()
    else:
        cropped = image.crop(padded_crop_box(bbox, image.size, PADDING))

    destination.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(destination)
    print(f"{source.name}: {image.size[0]}x{image.size[1]} -> {cropped.size[0]}x{cropped.size[1]}")


def main() -> int:
    missing = [name for name in STATE_FILES if not (SOURCE_DIR / name).exists()]
    if missing:
        print("Missing source sprites:", ", ".join(missing), file=sys.stderr)
        return 1

    for name in STATE_FILES:
        process_file(SOURCE_DIR / name, OUTPUT_DIR / name)

    print(f"Processed sprites written to {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
