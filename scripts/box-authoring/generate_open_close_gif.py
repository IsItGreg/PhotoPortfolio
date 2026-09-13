#!/usr/bin/env python3
"""Render a smooth open/close GIF from the V4 cardboard-mailer rig."""

from __future__ import annotations

import math
import shutil
from pathlib import Path

from PIL import Image

import generate_cardboard_box as box


OUT = Path(__file__).resolve().parent
SIZE = 640
FPS = 24
MOTION_FRAMES = 84
PAUSE_FRAMES = 12


def smootherstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * value * (value * (value * 6.0 - 15.0) + 10.0)


def ramp(value: float, start: float, end: float) -> float:
    return smootherstep((value - start) / max(end - start, 1e-9))


def rig_pose(node_by_name: dict[str, int], close_amount: float) -> dict[int, list[float]]:
    """Stage flaps so they fold and slide before the lid seats."""
    close_amount = max(0.0, min(1.0, close_amount))
    opening = 1.0 - close_amount
    # The rounded ears can slide forward AND upward as the lid begins to
    # rise. Start lifting while the apron is still opening, rather than
    # holding the lid shut until both ears are completely unfolded.
    release = ramp(opening, 0.0, 0.20)
    lid_open = ramp(opening, 0.08, 1.0)
    # Keep the ears aligned in their pockets during the initial sliding
    # withdrawal; their sideways spread overlaps the continuing lid lift.
    ear_release = ramp(lid_open, 0.075, 0.23)
    # Brief extraction flare, then fold back in during the continuing lift.
    # Overlap the easing curves to avoid a wide-open hold or sharp reversal.
    ear_settle = ramp(lid_open, 0.20, 0.38)
    ear_spread = (box.EAR_RELEASE_DEGREES * ear_release
                  - (box.EAR_RELEASE_DEGREES - box.EAR_OPEN_DEGREES) * ear_settle)
    ear_fold = math.radians(90.0 - ear_spread)
    # An 80-degree extraction tilt clears the rail; there is no flat-apron
    # pause. Settle back to the requested 60-degree fully open position.
    tuck_angle = math.radians(-80.0) * release + math.radians(20.0) * ramp(lid_open, 0.15, 0.40)
    # A modest wider flare, spread over more of the lift so it stays gentle.
    wing_angle = math.radians(box.WING_OPEN_DEGREES) * ramp(lid_open, 0.52, 0.82)

    return {
        node_by_name["CTRL_Lid"]: box.quat("x", -math.pi * lid_open),
        node_by_name["CTRL_TuckFlap"]: box.quat("x", tuck_angle),
        node_by_name["CTRL_TuckEar_L"]: box.quat("y", -ear_fold),
        node_by_name["CTRL_TuckEar_R"]: box.quat("y", ear_fold),
        node_by_name["CTRL_LidWing_L"]: box.quat("z", -wing_angle),
        node_by_name["CTRL_LidWing_R"]: box.quat("z", wing_angle),
    }


def main() -> None:
    textures = box.make_textures(size=1024)
    gltf, _binary, mesh_data = box.build_scene(textures)
    node_by_name = {node["name"]: index for index, node in enumerate(gltf["nodes"])}

    opening = [1.0 - index / (MOTION_FRAMES - 1) for index in range(MOTION_FRAMES)]
    timeline = (
        [1.0] * PAUSE_FRAMES
        + opening
        + [0.0] * PAUSE_FRAMES
        + list(reversed(opening))
    )

    frames = []
    rendered = {}
    for index, close_amount in enumerate(timeline):
        if close_amount not in rendered:
            rendered[close_amount] = box.render_preview(
                gltf,
                mesh_data,
                textures[0],
                pose="animation",
                size=SIZE,
                rotation_overrides=rig_pose(node_by_name, close_amount),
            )
        frames.append(rendered[close_amount])
        if index % 24 == 0:
            print(f'Rendered frame {index+1}/{len(timeline)}', flush=True)

    # One shared palette prevents color shimmer between frames.
    sample_indices = [0, len(frames) // 3, 2 * len(frames) // 3, len(frames) - 1]
    palette_source = Image.new("RGB", (SIZE * len(sample_indices), SIZE))
    for column, frame_index in enumerate(sample_indices):
        palette_source.paste(frames[frame_index], (column * SIZE, 0))
    palette = palette_source.quantize(colors=160, method=Image.Quantize.MEDIANCUT)
    gif_frames = [
        frame.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG)
        for frame in frames
    ]

    output = OUT / "cardboard_mailer_v4_open_close.gif"
    # GIF delays are centiseconds. Alternate 40/50 ms to average true 24 fps.
    durations = [(round((i+1)*100/FPS)-round(i*100/FPS))*10 for i in range(len(gif_frames))]
    gif_frames[0].save(
        output,
        save_all=True,
        append_images=gif_frames[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=False,
    )
    shutil.copyfile(output, OUT / "cardboard_mailer_front_release.gif")
    print(f"Wrote {output.name}: {len(gif_frames)} frames at {FPS} fps, {output.stat().st_size / 1_000_000:.2f} MB")


if __name__ == "__main__":
    main()
