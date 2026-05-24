from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "pets" / "codex_kitty" / "assets" / "yellow" / "pet" / "transparent"
TARGET = ROOT / "firmware" / "src" / "codex_kitty_sprites.h"
MAX_W = 78
MAX_H = 78
TRANSPARENT = 0x0001
STATES = [
    "idle",
    "running",
    "waiting",
    "done",
    "error",
    "research",
    "break",
    "longbreak",
]


def rgb565(r, g, b):
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)


def convert(path):
    image = Image.open(path).convert("RGBA")
    scale = min(MAX_W / image.width, MAX_H / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(size, Image.Resampling.LANCZOS)

    pixels = []
    for r, g, b, a in image.getdata():
        if a < 32:
            pixels.append(TRANSPARENT)
        else:
            value = rgb565(r, g, b)
            pixels.append(0x0002 if value == TRANSPARENT else value)
    return image.width, image.height, pixels


def emit_array(lines, name, pixels):
    lines.append(f"const uint16_t {name}[] PROGMEM = {{")
    for index in range(0, len(pixels), 12):
        chunk = pixels[index : index + 12]
        lines.append("  " + ", ".join(f"0x{value:04x}" for value in chunk) + ",")
    lines.append("};")
    lines.append("")


def main():
    converted = {}
    for state in STATES:
        converted[state] = convert(SOURCE_DIR / f"{state}.png")

    lines = [
        "#pragma once",
        "#include <Arduino.h>",
        "",
        f"constexpr uint16_t CODEX_KITTY_TRANSPARENT = 0x{TRANSPARENT:04x};",
        "",
        "struct CodexKittySprite {",
        "  const uint16_t* pixels;",
        "  uint16_t width;",
        "  uint16_t height;",
        "};",
        "",
    ]

    for state, (_, _, pixels) in converted.items():
        emit_array(lines, f"CODEX_KITTY_{state.upper()}", pixels)

    lines.append("enum class CodexKittySpriteId {")
    for state in STATES:
        lines.append(f"  {state.capitalize()},")
    lines.append("};")
    lines.append("")
    lines.append("const CodexKittySprite CODEX_KITTY_SPRITES[] = {")
    for state, (width, height, _) in converted.items():
        lines.append(
            f"  {{CODEX_KITTY_{state.upper()}, {width}, {height}}},"
        )
    lines.append("};")
    lines.append("")

    TARGET.write_text("\n".join(lines), encoding="utf-8")
    for state, (width, height, _) in converted.items():
        print(f"{state}: {width}x{height}")
    print(f"Wrote {TARGET}")


if __name__ == "__main__":
    main()
