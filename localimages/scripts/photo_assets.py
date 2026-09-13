#!/usr/bin/env python3
"""Prepare compressed, metadata-stripped WebP derivatives from local originals.

Run directly to audit/prepare catalog and legacy photos in the local export
cache. This does not select anything for publication. Originals are never
overwritten. Public URLs include a content hash for safe caches.
"""
import argparse
import base64
import hashlib
import io
import json
import re
from pathlib import Path
from urllib.parse import quote, unquote

from PIL import Image, ImageCms, ImageOps
from image_paths import library_images, valid_photo_key

ROOT = Path(__file__).resolve().parents[2]
SIZES = (480, 960, 1600, 2560)
RECIPE = 2


def jpeg_sources(root):
    directory = Path(root) / 'localimages/jpg'
    return {p.relative_to(directory.resolve()).with_suffix('').as_posix(): p
            for p in library_images(directory, ('.jpg', '.jpeg'))}


def strip_jpeg_metadata(data):
    """Remove EXIF, XMP, IPTC and comments without re-encoding image pixels.

    Keep ICC color profiles (APP2), JFIF and Adobe color markers. Exported JPEGs
    put metadata before the first scan; retain every encoded scan verbatim.
    """
    if data[:2] != b'\xff\xd8':
        raise ValueError('Invalid JPEG')
    output, offset = bytearray(data[:2]), 2
    while offset < len(data):
        start = offset
        if data[offset] != 255:
            raise ValueError('Invalid JPEG marker')
        while data[offset] == 255:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xda, 0xd9):
            output.extend(data[start:])
            return bytes(output)
        length = int.from_bytes(data[offset:offset + 2], 'big')
        end = offset + length
        if length < 2 or end > len(data):
            raise ValueError('Invalid JPEG segment')
        if marker not in (0xe1, 0xed, 0xfe):
            output.extend(data[start:end])
        offset = end
    raise ValueError('Incomplete JPEG')


def srgb_image(opened):
    image = ImageOps.exif_transpose(opened).convert('RGB')
    profile = opened.info.get('icc_profile')
    if profile:
        image = ImageCms.profileToProfile(
            image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
            ImageCms.createProfile('sRGB'), outputMode='RGB')
    # Exclude EXIF/GPS/XMP from public derivatives. Pixels are now sRGB.
    image.info.clear()
    return image


def encode(image, format, quality):
    buffer = io.BytesIO()
    options = {'method': 6} if format == 'WEBP' else {'optimize': True, 'progressive': True}
    image.save(buffer, format, quality=quality, **options)
    return buffer.getvalue()


def write_variant(public, key, data, extension, size):
    digest = hashlib.sha256(data).hexdigest()[:12]
    relative = f'images/optimized/{key}_{max(size)}-{digest}.{extension}'
    destination = Path(public) / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        destination.write_bytes(data)
    return {'url': '/' + quote(relative, safe='/'), 'width': size[0],
            'height': size[1], 'bytes': len(data)}


def source_signature(root, key, jpegs):
    signature = hashlib.sha256(str(RECIPE).encode())
    webp = Path(root) / f'localimages/webp/{key}.webp'
    if not webp.is_file():
        webp = Path(root) / f'public/images/twodim/{key}_full.webp'
    for path in (jpegs.get(key), webp):
        if path and path.is_file():
            signature.update(path.read_bytes())
    return signature.hexdigest()


def asset_current(root, key, asset, jpegs):
    return bool(asset and asset.get('recipe') == RECIPE
                and asset.get('signature') == source_signature(root, key, jpegs)
                and all(v['url'].endswith('.webp') for v in asset['variants'])
                and all((Path(root) / 'public' / unquote(v['url']).lstrip('/')).is_file()
                        for v in asset['variants']))


def prepare_photo(root, key, public=None, jpegs=None):
    if not valid_photo_key(key):
        raise ValueError('Invalid photo key')
    root = Path(root)
    public = Path(public) if public is not None else root / 'public'
    jpegs = jpegs if jpegs is not None else jpeg_sources(root)
    jpeg = jpegs.get(key)
    webp = root / f'localimages/webp/{key}.webp'
    if not webp.is_file():
        webp = root / f'public/images/twodim/{key}_full.webp'
    source = jpeg or webp
    signature = source_signature(root, key, jpegs)

    with Image.open(source) as opened:
        image = srgb_image(opened)
        # Never copy a JPEG or a library WebP verbatim into public output.
        # Keep the existing resolution for zooming, but always encode a lossy
        # WebP from the current color-corrected, metadata-stripped master.
        native_data = encode(image, 'WEBP', 82)
        full = write_variant(public, key, native_data, 'webp', image.size)
        variants = []
        for size in SIZES:
            if size >= max(image.size):
                continue
            resized = image.copy()
            resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            data, extension = encode(resized, 'WEBP', 82), 'webp'
            # A larger image that costs fewer bytes already serves this slot.
            if len(data) < len(native_data):
                variants.append(write_variant(public, key, data, extension, resized.size))
        variants.append(full)
        variants = [v for i, v in enumerate(variants)
                    if all(v['bytes'] < larger['bytes'] for larger in variants[i + 1:])]
        preview = image.copy()
        preview.thumbnail((24, 24), Image.Resampling.LANCZOS)
        placeholder = 'data:image/webp;base64,' + base64.b64encode(encode(preview, 'WEBP', 30)).decode()
        return {'width': image.width, 'height': image.height, 'placeholder': placeholder,
                'variants': variants, 'full': full, 'signature': signature, 'recipe': RECIPE}


def collect_keys(value):
    keys = set()
    if isinstance(value, dict):
        if 'yearFilename' in value:
            keys.add(value['yearFilename'])
        for item in value.values():
            keys.update(collect_keys(item))
    elif isinstance(value, list):
        for item in value:
            keys.update(collect_keys(item))
    return keys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--audit-only', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve()
    from photo_catalog import load_catalog
    catalog = load_catalog(root)
    # Include hidden/legacy references in the audit, so future gallery switches
    # do not bring back the old loading behavior. Never change gallery content.
    keys = collect_keys(catalog)
    legacy = (root / 'src/photos.ts').read_text()
    legacy = re.sub(r'//[^\n]*', '', legacy)
    keys.update(re.findall(r'yearFilename:\s*[`\"]([^`\"]+)', legacy))
    box_manifest = root / 'public/images/threedimbox/manifest.json'
    if box_manifest.exists():
        keys.update(unquote(item['url']).removeprefix('/images/threedimbox/').rsplit('.', 1)[0]
                    for item in json.loads(box_manifest.read_text()))
    jpegs = jpeg_sources(root)
    manifest_path = root / 'localimages/photo-assets.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    rows = []
    for index, key in enumerate(sorted(keys)):
        row = {'photo': key}
        for label, path in [('jpeg', jpegs.get(key)),
                            ('libraryWebp', root / f'localimages/webp/{key}.webp'),
                            ('oldSmall', root / f'public/images/twodim/{key}_small.webp'),
                            ('oldFull', root / f'public/images/twodim/{key}_full.webp')]:
            if path and path.is_file():
                with Image.open(path) as image:
                    row[label] = {'bytes': path.stat().st_size, 'width': image.width, 'height': image.height}
        if not args.audit_only:
            if not asset_current(root, key, manifest.get(key), jpegs):
                manifest[key] = prepare_photo(root, key, jpegs=jpegs)
            row['variants'] = manifest[key]['variants']
            row['native'] = manifest[key]['full']
        rows.append(row)
        print(f'{index + 1}/{len(keys)} {key}', flush=True)
    if not args.audit_only:
        temporary = manifest_path.with_suffix('.tmp')
        temporary.write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
        temporary.replace(manifest_path)
    report = root / 'localimages/photo-loading-audit.json'
    report.write_text(json.dumps(rows, indent=2) + '\n')
    print(f'Audit: {report}')


if __name__ == '__main__':
    main()
