#!/usr/bin/env python3
"""Deterministic local-source -> production scene bake. No network or deploy.

Only generated assets are overwritten. Each stage is fingerprinted, and its
output hashes checked, so deleted/corrupt/stale outputs are rebuilt as needed.
"""
import hashlib
import fcntl
import importlib.util
import io
import json
import math
import os
from pathlib import Path
import struct
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFont, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]
SCENE = ROOT / 'src/ThreeDim'
SOURCE = SCENE / 'authoring'
CACHE = ROOT / '.cache/three-scene'
PUBLIC = ROOT / 'public'
MASTER = SOURCE / 'cardboard_mailer_v4_seam_filled_rigged.glb'
sys.path.insert(0, str(ROOT / 'scripts/box-authoring'))
from export_web_box import export
from validate_web_box import check

spec = importlib.util.spec_from_file_location('texture_optimizer', ROOT / 'scripts/optimize-three-assets.py')
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_changed(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == data:
        return
    # Publish each completed file atomically; never expose a partial GLB/JSON.
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as staged:
        staged.write(data)
        temporary = staged.name
    os.chmod(temporary, 0o644)
    os.replace(temporary, path)


def encode_json(value):
    return (json.dumps(value, indent=2, sort_keys=True) + '\n').encode()


def fingerprint(inputs):
    digest = hashlib.sha256(f'{pillow_version}/{np.__version__}'.encode())
    for path in sorted(inputs):
        digest.update(str(path.relative_to(ROOT)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def font_metrics(path):
    """Match Troika's OS/2 typo metrics (not FreeType's win/hhea line box)."""
    raw = path.read_bytes()
    tables = {}
    for index in range(struct.unpack_from('>H', raw, 4)[0]):
        tag, _, offset, _ = struct.unpack_from('>4sIII', raw, 12 + index * 16)
        tables[tag] = offset
    em = struct.unpack_from('>H', raw, tables[b'head'] + 18)[0]
    base = tables.get(b'OS/2')
    asc, desc, gap = struct.unpack_from('>hhh', raw, base + 68 if base is not None else tables[b'hhea'] + 4)
    return em, asc, desc, gap


def bake_label(label, font_path, output):
    # Transparent ink, with real font advance widths and baseline alignment.
    # Keep the transforms outside the bitmap so they stay shared/editable.
    text = label['text']
    if not text.strip() or any(ord(ch) > 127 for ch in text):
        raise ValueError('This label baker supports nonempty ASCII text. Complex-script shaping needs a shaping-aware baker.')
    em, asc, desc, gap = font_metrics(font_path)
    size = float(label['fontSize'])
    if not 0 < size <= 10:
        raise ValueError('Label fontSize must be between 0 and 10')
    pixels_per_unit = 256
    font_size = round(size * pixels_per_unit)
    font = ImageFont.truetype(str(font_path), font_size, layout_engine=ImageFont.Layout.BASIC)
    # Use the exact integer raster font size as the world/pixel conversion.
    density = font_size / size
    lines = text.split('\n')
    line_height = ((asc - desc + gap) / em if label['lineHeight'] == 'normal' else float(label['lineHeight'])) * size
    if line_height <= 0:
        raise ValueError('Label lineHeight must be positive')
    half_leading = (line_height - (asc - desc) * size / em) / 2
    first_baseline = len(lines) * line_height / 2 - half_leading - asc * size / em
    placements, bounds = [], []
    for index, line in enumerate(lines):
        x = -font.getlength(line) / 2
        y = -(first_baseline - index * line_height) * density
        left, top, right, bottom = font.getbbox(line, anchor='ls')
        placements.append((x, y, line))
        bounds.append((x + left, y + top, x + right, y + bottom))
    left = math.floor(min(b[0] for b in bounds)) - 4
    top = math.floor(min(b[1] for b in bounds)) - 4
    right = math.ceil(max(b[2] for b in bounds)) + 4
    bottom = math.ceil(max(b[3] for b in bounds)) + 4
    if max(right - left, bottom - top) > 4096:
        raise ValueError('Label texture exceeds 4096px; shorten text or reduce font size')
    image = Image.new('RGBA', (right - left, bottom - top), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    for x, y, line in placements:
        draw.text((x - left, y - top), line, font=font, fill='white', anchor='ls')
    output.parent.mkdir(parents=True, exist_ok=True)
    encoded = io.BytesIO()
    image.save(encoded, format='WEBP', lossless=True, method=6, exact=True)
    write_changed(output, encoded.getvalue())
    return {'id': label['id'], 'width': image.width / density, 'height': image.height / density,
            'center': [(left + right) / 2 / density, -(top + bottom) / 2 / density]}


def url(path):
    return '/' + str(path.relative_to(PUBLIC)) + '?v=' + sha(path)[:16]


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE / 'state.json'
    try:
        previous = json.loads(cache_path.read_text())
    except (FileNotFoundError, ValueError):
        previous = {}
    state = {}
    common = [Path(__file__), ROOT / 'scripts/optimize-three-assets.py']

    def stage(name, inputs, outputs, action):
        signature = fingerprint(common + inputs)
        old = previous.get(name, {})
        if old.get('signature') == signature and all(p.exists() and sha(p) == old.get('outputs', {}).get(str(p.relative_to(ROOT))) for p in outputs):
            print(f'{name}: unchanged (hashes verified)', flush=True)
            result = old['result']
        else:
            print(f'{name}: baking…', flush=True)
            result = action()
        state[name] = {'signature': signature, 'outputs': {str(p.relative_to(ROOT)): sha(p) for p in outputs}, 'result': result}
        return result

    lossless = CACHE / 'cardboard_mailer_web.glb'
    model = PUBLIC / 'models/cardboard-mailer.glb'

    def bake_model():
        export(MASTER, lossless)
        # Check every triangle/UV/normal over both full opening and closing clips.
        check(MASTER, lossless)
        compressed = CACHE / 'cardboard-mailer-compressed.glb'
        report = optimizer.optimize_box(lossless, compressed)
        write_changed(model, compressed.read_bytes())
        return report

    model_report = stage('box', [MASTER, *sorted((ROOT / 'scripts/box-authoring').glob('*.py'))], [model, lossless, lossless.with_suffix('.audit.json')], bake_model)
    wood = {}
    for name in ('Color', 'NormalDX'):
        source = SOURCE / f'Wood051_1K-JPG_{name}.jpg'
        output = PUBLIC / f'textures/wood-{name.lower()}-q90.webp'
        def bake_wood(source=source, output=output):
            write_changed(output, optimizer.webp(source.read_bytes(), 90))
            return {'bytes': output.stat().st_size}
        stage(f'wood-{name}', [source], [output], bake_wood)
        wood[name] = url(output)

    config_path = SCENE / 'sceneConfig.json'
    config = json.loads(config_path.read_text())
    ids = [label['id'] for label in config['labels']]
    if len(ids) != len(set(ids)) or any(not item or not all(c.isalnum() or c == '-' for c in item) for item in ids):
        raise ValueError('Label IDs must be unique, nonempty alphanumeric/hyphen names')
    outputs = [PUBLIC / f'textures/box-label-{item}.webp' for item in ids]
    labels = stage('labels', [config_path, SOURCE / 'LOSTLATE.ttf'], outputs,
                   lambda: [bake_label(label, SOURCE / 'LOSTLATE.ttf', output) for label, output in zip(config['labels'], outputs)])
    labels = [{**label, 'url': url(output)} for label, output in zip(labels, outputs)]
    manifest = {'model': url(model), 'woodColor': wood['Color'], 'woodNormal': wood['NormalDX'], 'labels': labels}
    write_changed(SCENE / 'generated/scene-assets.json', encode_json(manifest))
    write_changed(cache_path, encode_json(state))
    report = {'masterSha256': sha(MASTER), 'model': model_report, 'labelsBytes': sum(p.stat().st_size for p in outputs), 'manifest': manifest}
    write_changed(CACHE / 'report.json', encode_json(report))
    print(f'Ready: model {model.stat().st_size:,} bytes; labels {report["labelsBytes"]:,} bytes. Sources preserved. Nothing deployed.')


if __name__ == '__main__':
    CACHE.mkdir(parents=True, exist_ok=True)
    # npm start and npm build may run together. Never race on intermediates.
    with (CACHE / 'bake.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another scene bake is running; waiting for its output…', flush=True)
            fcntl.flock(lock, fcntl.LOCK_EX)
        main()
