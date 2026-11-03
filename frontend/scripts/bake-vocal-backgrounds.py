#!/usr/bin/env python3
"""Bake the configured white-background illustrations; requires Pillow.

Run from any directory: python3 frontend/scripts/bake-vocal-backgrounds.py
The *-raw files are inputs only. Outputs are lossless transparent WebP files.
"""

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ASSETS = Path(__file__).resolve().parents[1] / "public" / "vocals"
# Only confirmed background holes get seeds; enclosed white clothing stays opaque.
JOBS = {
    "yanhe": {
        "raw": "yanhe-raw.webp",
        "seeds": [(189, 197), (129, 564), (176, 584), (186, 650), (251, 752)],
    },
    "yuezhengling": {
        "raw": "yuezhengling-raw.webp",
        "seeds": [(194, 315), (253, 550)],
        "white_ink_region": (35, 700, 112, 840),
    },
    "yuezhenglongya": {
        "raw": "yuezhenglongya-raw.webp",
        "seeds": [],
        "white_ink_region": (392, 700, 479, 840),
    },
    "zhiyunmoke": {
        "raw": "zhiyunmoke-raw.webp",
        "seeds": [],
        "white_ink_region": (35, 700, 112, 840),
    },
    "moqingxian": {
        "raw": "moqingxian-raw.webp",
        "seeds": [(154, 282), (229, 316), (208, 360), (438, 246), (448, 334), (364, 296)],
        "white_ink_region": (35, 700, 112, 840),
    },
    "xingchen": {
        "raw": "xingchen-raw.jpg",
        "seeds": [(200, 212), (220, 300), (520, 340), (500, 382), (425, 160), (341, 610)],
    },
}
TOLERANCE = 20


def bake_background(source, seeds, white_ink_region=None):
    with Image.open(source) as raw:
        if raw.convert("RGBA").getchannel("A").getextrema()[0] < 255:
            raise ValueError(f"{source.name} already has transparency; leave it unchanged")
        image = raw.convert("RGB")
    width, height = image.size
    channels = image.split()
    pixels = list(zip(*(channel.tobytes() for channel in channels)))
    background = bytearray(width * height)
    queue = deque()

    def visit(index):
        if not background[index] and min(pixels[index]) >= 255 - TOLERANCE:
            background[index] = 255
            queue.append(index)

    for x in range(width):
        visit(x)
        visit((height - 1) * width + x)
    for y in range(height):
        visit(y * width)
        visit(y * width + width - 1)
    for x, y in seeds:
        if not (0 <= x < width and 0 <= y < height):
            raise ValueError(f"Background seed {(x, y)} is outside {source.name}")
        if min(pixels[y * width + x]) < 255 - TOLERANCE:
            raise ValueError(f"Background seed {(x, y)} is not near-white in {source.name}")
        visit(y * width + x)

    while queue:
        index = queue.popleft()
        x, y = index % width, index // width
        if x:
            visit(index - 1)
        if x + 1 < width:
            visit(index + 1)
        if y:
            visit(index - width)
        if y + 1 < height:
            visit(index + width)

    # The orange seal has white lettering connected to the page background.
    # Preserve the white ink between each row's colored edges inside its region.
    if white_ink_region:
        left, top, right, bottom = white_ink_region
        for y in range(top, bottom):
            colored = [x for x in range(left, right)
                       if max(pixels[y * width + x]) - min(pixels[y * width + x]) > 80]
            if colored:
                for x in range(min(colored), max(colored) + 1):
                    background[y * width + x] = 0

    # Refine only a two-pixel boundary band. Estimate opacity from nearby darker
    # ink, then undo its blend with white to avoid white halos on dark pages.
    # Unselected near-white areas (clothing, skin, logos) keep their original RGB.
    mask = Image.frombytes("L", image.size, bytes(background))
    fringe = mask.filter(ImageFilter.MaxFilter(5)).tobytes()
    darkest = ImageChops.darker(ImageChops.darker(channels[0], channels[1]), channels[2])
    local_ink = darkest.filter(ImageFilter.MinFilter(5)).tobytes()
    output = []
    for index, rgb in enumerate(pixels):
        if background[index]:
            output.append((0, 0, 0, 0))
            continue
        alpha = 255
        if fringe[index] and min(rgb) < 255 - TOLERANCE:
            contrast = 255 - local_ink[index]
            if contrast:
                alpha = max(1, min(255, round(255 * (255 - min(rgb)) / contrast)))
        if alpha < 255:
            rgb = tuple(max(0, min(255, round(255 - (255 - value) * 255 / alpha))) for value in rgb)
        output.append((*rgb, alpha))

    result = Image.new("RGBA", image.size)
    result.putdata(output)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("names", nargs="*", help=f"Names to bake (default: {', '.join(JOBS)})")
    args = parser.parse_args()
    names = args.names or list(JOBS)
    for name in names:
        if name not in JOBS:
            parser.error(f"Unknown illustration: {name}")
    for name in names:
        job = JOBS[name]
        result = bake_background(ASSETS / job["raw"], job["seeds"], job.get("white_ink_region"))
        destination = ASSETS / f"{name}.webp"
        result.save(destination, "WEBP", lossless=True, exact=True, method=6)
        print(f"{job['raw']} -> {destination.name} ({result.width}x{result.height}, RGBA)")


if __name__ == "__main__":
    main()
