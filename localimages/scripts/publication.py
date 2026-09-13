"""Allowlist public photos. Originals/private drafts never enter deployment output."""
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from urllib.parse import unquote, urlsplit
from PIL import Image
from image_paths import valid_photo_key
from photo_catalog import atomic_write, encoded, load_catalog, public_catalog, visible_photo_keys
from photo_assets import RECIPE, asset_current, jpeg_sources, prepare_photo, srgb_image, encode


def local_public_file(root, url, prefix):
    parsed = urlsplit(url)
    relative = unquote(parsed.path).lstrip('/')
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or not parsed.path.startswith(prefix):
        raise ValueError(f'Invalid photo URL: {url}')
    public = (Path(root) / 'public').resolve()
    path = public / relative
    if '..' in Path(relative).parts or public not in path.resolve().parents or path.is_symlink() or not path.is_file():
        raise ValueError(f'Missing or unsafe photo export: {relative}')
    return path, relative


def box_entries(root):
    path = Path(root) / 'public/images/threedimbox/manifest.json'
    entries = json.loads(path.read_text()) if path.exists() else []
    if not isinstance(entries, list):
        raise ValueError('Invalid box manifest')
    result, seen = [], set()
    for entry in entries:
        path, relative = local_public_file(root, entry['url'], '/images/threedimbox/')
        key = relative.removeprefix('images/threedimbox/').removesuffix('.webp')
        if path.suffix != '.webp' or not valid_photo_key(key) or key in seen:
            raise ValueError('Invalid or duplicate box photo')
        seen.add(key)
        result.append({key: entry[key] for key in ('url', 'aspectRatio', 'vertical')})
    return result


def verify_compressed(path):
    with Image.open(path) as image:
        if image.format != 'WEBP' or image.getexif() or image.info.get('xmp'):
            raise ValueError(f'Photo must be a metadata-free WebP: {path.name}')
    # Pillow lossy WebPs have a VP8 (not VP8L) image chunk. Inspect actual
    # chunks, not just filename extensions or an arbitrary byte substring.
    raw = path.read_bytes()
    offset, lossy = 12, False
    while offset + 8 <= len(raw):
        kind = raw[offset:offset + 4]
        length = int.from_bytes(raw[offset + 4:offset + 8], 'little')
        lossy |= kind == b'VP8 '
        if kind in (b'EXIF', b'XMP ', b'VP8L', b'ANIM', b'ANMF'):
            raise ValueError(f'Unsupported/unoptimized photo chunk: {path.name}')
        offset += 8 + length + length % 2
    if not lossy:
        raise ValueError(f'Photo is not a compressed lossy WebP: {path.name}')


def publication_plan(root, prepare=True):
    root = Path(root)
    catalog = public_catalog(load_catalog(root))
    keys = visible_photo_keys(catalog)
    cache_path = root / 'localimages/photo-assets.json'
    old_public = root / 'public/photo-assets.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else (
        json.loads(old_public.read_text()) if old_public.exists() else {})
    jpegs = jpeg_sources(root) if prepare else None
    manifest, files = {}, {}
    for index, key in enumerate(sorted(keys)):
        asset = cache.get(key)
        if prepare and not asset_current(root, key, asset, jpegs):
            print(f'Compressing public photo {index + 1}/{len(keys)}: {key}', flush=True)
            asset = cache[key] = prepare_photo(root, key, jpegs=jpegs)
            # Resume an interrupted first conversion without repeating photos.
            atomic_write(cache_path, encoded(cache))
        if not asset or asset.get('recipe') != RECIPE:
            raise ValueError(f'Photo needs preparation: {key}; run npm run photos:publish')
        variants = asset['variants']
        if not variants or asset['full'] not in variants:
            raise ValueError('Invalid photo variants')
        for variant in variants:
            source, relative = local_public_file(root, variant['url'], '/images/optimized/')
            if source.suffix != '.webp':
                raise ValueError('Original JPEG passthrough is not allowed')
            verify_compressed(source)
            expected = source.stem.rsplit('-', 1)[-1]
            if hashlib.sha256(source.read_bytes()).hexdigest()[:12] != expected:
                raise ValueError(f'Photo hash mismatch: {source.name}')
            files[relative] = source
        manifest[key] = {field: asset[field] for field in ('width', 'height', 'placeholder', 'variants', 'full')}
        # Compatibility fallbacks use the SAME newly compressed derivatives,
        # never old full exports. Only explicitly visible photos get aliases.
        files[f'images/twodim/{key}_small.webp'] = local_public_file(root, variants[0]['url'], '/images/optimized/')[0]
        files[f'images/twodim/{key}_full.webp'] = local_public_file(root, asset['full']['url'], '/images/optimized/')[0]
    if prepare:
        atomic_write(cache_path, encoded(cache))
    box = box_entries(root)
    for entry in box:
        source, relative = local_public_file(root, entry['url'], '/images/threedimbox/')
        try:
            verify_compressed(source)
        except ValueError:
            if not prepare:
                raise
            # Preserve the existing bordered original locally if an old export
            # carries metadata or uses lossless encoding, then make a derivative.
            backup = root / 'localimages/box-export-originals' / Path(relative).relative_to('images/threedimbox')
            if not backup.exists():
                atomic_write(backup, source.read_bytes())
            with Image.open(source) as opened:
                atomic_write(source, encode(srgb_image(opened), 'WEBP', 85))
            verify_compressed(source)
        files[relative] = source
    return catalog, manifest, box, files


def publish(root, output=None, prepare=True, writer=atomic_write):
    root = Path(root).resolve()
    output = Path(output).resolve() if output is not None else root / 'public'
    if output not in (root / 'public', root / 'build') or output.is_symlink():
        raise ValueError('Publication output must be this project\'s public or build directory')
    catalog, manifest, box, files = publication_plan(root, prepare)
    output.mkdir(parents=True, exist_ok=True)
    if output == root / 'build':
        # Replace only this disposable build's image tree. The local public
        # export cache and private originals are never pruned.
        cache_directory = root / '.cache'
        cache_directory.mkdir(parents=True, exist_ok=True)
        metadata_before = {output / name: (output / name).read_bytes() if (output / name).exists() else None
                           for name in ('photo-pages.json', 'photo-assets.json')}
        with tempfile.TemporaryDirectory(prefix='photo-publication-', dir=cache_directory) as temporary:
            temporary = Path(temporary)
            staged = temporary / 'images'
            staged.mkdir()
            for relative, source in files.items():
                writer(temporary / relative, source.read_bytes())
            writer(staged / 'threedimbox/manifest.json', encoded(box))
            previous = temporary / 'previous-images'
            destination = output / 'images'
            if destination.is_symlink():
                raise ValueError('Refusing to replace a symlinked build image directory')
            if destination.exists():
                destination.rename(previous)
            try:
                staged.rename(destination)
                writer(output / 'photo-pages.json', encoded(catalog))
                writer(output / 'photo-assets.json', encoded(manifest))
            except Exception:
                if destination.exists():
                    destination.rename(temporary / 'failed-images')
                if previous.exists():
                    previous.rename(destination)
                for path, data in metadata_before.items():
                    if data is None:
                        path.unlink(missing_ok=True)
                    else:
                        atomic_write(path, data)
                raise
        test_images = output / 'testimgs'
        if test_images.is_symlink():
            raise ValueError('Unexpected symlinked sample photo directory')
        if test_images.exists():
            shutil.rmtree(test_images)
    else:
        # This is localhost's asset cache, not a deployment directory. Retain
        # old exports so removing/hiding a photo cannot destroy local work.
        writer(output / 'photo-pages.json', encoded(catalog))
        writer(output / 'photo-assets.json', encoded(manifest))
    return {'visiblePages': len(catalog['pages']), 'galleries': len(catalog['galleries']),
            'galleryPhotos': len(manifest), 'boxPhotos': len(box),
            'imageFiles': len(files), 'imageBytes': sum(source.stat().st_size for source in files.values())}


def verify_build(root):
    root = Path(root).resolve()
    catalog, manifest, box, files = publication_plan(root, prepare=False)
    build = root / 'build'
    for name, expected in [('photo-pages.json', catalog), ('photo-assets.json', manifest),
                           ('images/threedimbox/manifest.json', box)]:
        if json.loads((build / name).read_text()) != expected:
            raise ValueError(f'Stale/unfiltered publication metadata: {name}')
    expected = set(files) | {'images/threedimbox/manifest.json'}
    actual = {p.relative_to(build).as_posix() for p in (build / 'images').rglob('*') if p.is_file()}
    if actual != expected:
        raise ValueError('Build contains missing, unselected, or original photo files')
    for relative, source in files.items():
        destination = build / relative
        if destination.is_symlink() or destination.read_bytes() != source.read_bytes():
            raise ValueError(f'Invalid published photo: {relative}')
    if (build / 'testimgs').exists() or list(build.rglob('*.map')):
        raise ValueError('Sample originals or production source maps leaked into the build')
    print(f'Publication verified: {len(manifest)} visible-gallery photos, {len(box)} box photos; no hidden pages, originals, or source maps.')
