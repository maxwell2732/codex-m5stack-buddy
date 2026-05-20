#!/usr/bin/env python3
"""Remove near-white backgrounds from Codex-Kitty scene assets.

This produces transparent PNGs for small scene composition without replacing
the original source files.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Install it with: pip install pillow", file=sys.stderr)
    raise SystemExit(1)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
YELLOW_ASSETS = PROJECT_ROOT / "pets" / "codex_kitty" / "assets" / "yellow"
PET_DIR = YELLOW_ASSETS / "pet"
PET_OUTPUT_DIR = PET_DIR / "transparent"
SCENE_DIR = YELLOW_ASSETS / "scene"
SCENE_OUTPUT_DIR = SCENE_DIR / "transparent"
PET_FILES = [
    "idle.png",
    "running.png",
    "waiting.png",
    "done.png",
    "error.png",
    "research.png",
    "break.png",
    "longbreak.png",
]
SCENE_FILES = ["ground_patch.png", "ground_strip.png", "house_idle.png", "house_sleep.png"]
WHITE_THRESHOLD = 244


def remove_white_background(source: Path, destination: Path, trim: bool = False) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    def is_background_pixel(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return bool(alpha) and red >= WHITE_THRESHOLD and green >= WHITE_THRESHOLD and blue >= WHITE_THRESHOLD

    for x in range(width):
        for y in (0, height - 1):
            if is_background_pixel(x, y):
                queue.append((x, y))
                visited.add((x, y))

    for y in range(height):
        for x in (0, width - 1):
            if (x, y) not in visited and is_background_pixel(x, y):
                queue.append((x, y))
                visited.add((x, y))

    while queue:
        x, y = queue.popleft()
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                if is_background_pixel(nx, ny):
                    visited.add((nx, ny))
                    queue.append((nx, ny))

    if trim:
        bbox = image.getchannel("A").getbbox()
        if bbox:
            image = image.crop(bbox)

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination)
    print(f"{source.relative_to(PROJECT_ROOT)} -> {destination.relative_to(PROJECT_ROOT)}")


def main() -> int:
    jobs: list[tuple[Path, Path]] = []

    for file_name in PET_FILES:
        source = PET_DIR / file_name
        if not source.exists():
            print(f"Missing pet sprite: {source}", file=sys.stderr)
            return 1
        jobs.append((source, PET_OUTPUT_DIR / file_name))

    for file_name in SCENE_FILES:
        source = SCENE_DIR / file_name
        if source.exists():
            jobs.append((source, SCENE_OUTPUT_DIR / file_name))
        else:
            print(f"Skipping missing scene asset: {source.relative_to(PROJECT_ROOT)}")

    for source, destination in jobs:
        remove_white_background(source, destination, trim=source.name == "ground_strip.png")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
