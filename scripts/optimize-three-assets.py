#!/usr/bin/env python3
"""Create website textures; never change the editable box, rig, or animation.

Requires Pillow. Run from any directory with --source pointing at the lossless
website GLB (not an already compressed output). Original wood JPGs are retained.
"""
import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and length == len(raw)
    size, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(raw[20:20 + size])
    binary_size, kind = struct.unpack_from('<II', raw, 20 + size)
    assert kind == 0x004E4942
    return doc, raw[28 + size:28 + size + binary_size], raw


def view_bytes(doc, binary, index):
    view = doc['bufferViews'][index]
    start = view.get('byteOffset', 0)
    return binary[start:start + view['byteLength']]


def webp(raw, quality):
    image = Image.open(io.BytesIO(raw)).convert('RGB')
    result = io.BytesIO()
    image.save(result, format='WEBP', quality=quality, method=6)
    encoded = result.getvalue()
    assert Image.open(io.BytesIO(encoded)).size == image.size
    return encoded


def optimize_box(source, output):
    assert source.resolve() != output.resolve(), 'Keep the source lossless.'
    original, binary, raw = read_glb(source)
    doc = copy.deepcopy(original)
    replacement = {}
    report = []
    for image in doc['images']:
        # This derivative already uses EXT_texture_webp; no loader/rig changes.
        assert image['mimeType'] == 'image/webp'
        index = image['bufferView']
        before = view_bytes(original, binary, index)
        after = webp(before, 95)
        replacement[index] = after
        report.append({'name': image['name'], 'before': len(before),
                       'after': len(after), 'quality': 95,
                       'resolution': list(Image.open(io.BytesIO(before)).size)})

    packed = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        packed.extend(b'\0' * (-len(packed) % 4))
        value = replacement.get(index, view_bytes(original, binary, index))
        view['byteOffset'], view['byteLength'] = len(packed), len(value)
        packed.extend(value)
    doc['buffers'][0]['byteLength'] = len(packed)
    encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode()
    encoded += b' ' * (-len(encoded) % 4)
    packed.extend(b'\0' * (-len(packed) % 4))
    result = (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(packed))
              + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
              + struct.pack('<II', len(packed), 0x004E4942) + packed)
    # Every non-image byte and all scene metadata remain exactly unchanged.
    for index in range(len(doc['bufferViews'])):
        if index not in replacement:
            assert view_bytes(doc, packed, index) == view_bytes(original, binary, index)
    for key in original.keys() - {'bufferViews', 'buffers'}:
        assert doc[key] == original[key], key
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(result)
    check, check_binary, _ = read_glb(output)
    for index in range(len(doc['bufferViews'])):
        assert view_bytes(check, check_binary, index) == view_bytes(doc, packed, index)
    return {'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'outputSha256': hashlib.sha256(result).hexdigest(),
            'before': len(raw), 'after': len(result), 'textures': report,
            'nonTextureDataByteIdentical': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    report = {'box': optimize_box(args.source, ROOT / 'public/models/cardboard-mailer.glb')}
    textures = ROOT / 'public/textures'
    textures.mkdir(parents=True, exist_ok=True)
    report['wood'] = []
    for name in ('Color', 'NormalDX'):
        source = ROOT / 'public' / f'Wood051_1K-JPG_{name}.jpg'
        raw = source.read_bytes()
        value = webp(raw, 90)
        (textures / f'wood-{name.lower()}-q90.webp').write_bytes(value)
        report['wood'].append({'name': name, 'before': len(raw), 'after': len(value)})
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
