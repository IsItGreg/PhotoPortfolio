#!/usr/bin/env python3
"""Local photo-page editor. Run with `npm run photos:pages`."""
import argparse
import hashlib
import io
import json
import mimetypes
import re
import sys
import tempfile
import threading
import uuid
from datetime import datetime
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, parse_qs
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / 'localimages/scripts'))
from image_paths import library_images, valid_photo_key
from photo_assets import prepare_photo, jpeg_sources, asset_current
from three_dim_image_prep import add_white_border
from photo_catalog import catalog_path as private_catalog_path, load_catalog
from publication import publish

UI_ROOT = Path(__file__).resolve().parent
RESERVED = {'old', 'studio', 'preview', 'about'}


class Invalid(ValueError):
    pass


class Conflict(ValueError):
    pass


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    try:
        temporary.write_bytes(data)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def migrate_catalog(value):
    if value.get('version') == 2:
        return value
    if value.get('version') != 1:
        raise Invalid('Unsupported page catalog. Reload Page Studio to use the latest editor.')
    pages, galleries = [], []
    for gallery in value['galleries']:
        page_ids = []
        for index, page in enumerate(gallery['pages']):
            page_id = f"{gallery['id']}-page-{index + 1}"
            pages.append({'id': page_id, 'title': f"{gallery['title']} — Page {index + 1}",
                          'visible': True, 'rows': page['rows']})
            page_ids.append(page_id)
        galleries.append({'id': gallery['id'], 'title': gallery['title'], 'slug': gallery['slug'],
                          'visible': True, 'pageIds': page_ids})
    return {'version': 2, 'pages': pages, 'galleries': galleries}


class Studio:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.public = self.root / 'public'
        self.catalog_path = private_catalog_path(self.root)
        self.box_manifest = self.public / 'images/threedimbox/manifest.json'
        self.lock = threading.Lock()

    def catalog(self):
        if not self.catalog_path.exists():
            load_catalog(self.root)
        raw = self.catalog_path.read_bytes()
        return {'catalog': migrate_catalog(json.loads(raw)), 'revision': hashlib.sha256(raw).hexdigest()}

    def box(self):
        raw = self.box_manifest.read_bytes() if self.box_manifest.exists() else b''
        if raw:
            entries = json.loads(raw)
            if not isinstance(entries, list):
                raise Invalid('The photo box manifest is invalid.')
            keys = []
            for entry in entries:
                url = entry.get('url', '') if isinstance(entry, dict) else ''
                prefix = '/images/threedimbox/'
                if not url.startswith(prefix) or not url.endswith('.webp'):
                    raise Invalid('The photo box contains an invalid image address.')
                key = unquote(url[len(prefix):-5])
                if not valid_photo_key(key) or key in keys:
                    raise Invalid('The photo box contains an invalid or duplicate photo.')
                keys.append(key)
        else:
            base = self.box_manifest.parent
            keys = [path.relative_to(base.resolve()).with_suffix('').as_posix()
                    for path in library_images(base)]
        # PhotoStack reverses the manifest before showing its first card.
        return {'keys': list(reversed(keys)), 'revision': hashlib.sha256(raw).hexdigest()}

    def box_file(self, key):
        if not valid_photo_key(key):
            return None
        base = self.box_manifest.parent.resolve()
        path = (base / f'{key}.webp').resolve()
        return path if base in path.parents and path.is_file() else None

    def validate_box(self, keys, sources):
        if not isinstance(keys, list) or len(keys) > 600 or not all(valid_photo_key(key) for key in keys):
            raise Invalid('Choose up to 600 library photos for the box.')
        if len(set(keys)) != len(keys):
            raise Invalid('A photo can appear only once in the box.')
        for key in keys:
            if key not in sources and not self.box_file(key):
                raise Invalid(f'Photo missing from the library and box: {key}')

    def prepare_box(self, keys, sources, temporary):
        pending, entries = [], []
        existing = json.loads(self.box_manifest.read_text()) if self.box_manifest.exists() else []
        by_key = {unquote(item['url']).removeprefix('/images/threedimbox/').removesuffix('.webp'): item
                  for item in existing}
        for key in reversed(keys):
            source = self.box_file(key)
            if source is None:
                source = temporary / 'box' / f'{key}.webp'
                source.parent.mkdir(parents=True, exist_ok=True)
                add_white_border(sources[key], source)
                pending.append((source, self.box_manifest.parent / f'{key}.webp'))
            if key in by_key and not any(dest == self.box_manifest.parent / f'{key}.webp' for _, dest in pending):
                entries.append(by_key[key])
            else:
                with Image.open(source) as image:
                    ratio = image.width / image.height
                entries.append({'url': '/images/threedimbox/' + quote(key, safe='/') + '.webp',
                                'aspectRatio': round(ratio, 4), 'vertical': ratio < 1})
        return pending, entries

    def sources(self):
        source_root = (self.root / 'localimages/webp').resolve()
        result = {}
        for path in library_images(source_root):
            result[path.relative_to(source_root).with_suffix('').as_posix()] = path
        return result

    def library(self):
        metadata = {}
        for page in self.catalog()['catalog']['pages']:
            for row in page['rows']:
                for photo in row:
                    metadata.setdefault(photo['yearFilename'], photo)
        result = []
        for key, path in self.sources().items():
            parts = key.split('/')
            with Image.open(path) as image:
                width, height = image.size
            result.append({
                'key': key, 'year': parts[0], 'group': '/'.join(parts[1:-1]), 'filename': path.name,
                'width': width, 'height': height,
                'photo': metadata.get(key, {'yearFilename': key, 'title': path.stem,
                    'location': '', 'date': '',
                    'aspect': 'vertical' if width < height else 'square' if width == height else 'horizontal'}),
            })
        return result

    def validate(self, catalog):
        if not isinstance(catalog, dict) or catalog.get('version') != 2:
            raise Invalid('Reload Page Studio to use the latest page library. Your old draft can be restored after reloading.')
        galleries, pages = catalog.get('galleries'), catalog.get('pages')
        if not isinstance(galleries, list) or len(galleries) > 30:
            raise Invalid('Keep at most 30 galleries.')
        if not isinstance(pages, list) or len(pages) > 600:
            raise Invalid('Keep at most 600 pages in the library.')
        def valid_id(value):
            return isinstance(value, str) and len(value) <= 120 and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value)
        sources = self.sources()
        ids, slugs, page_ids, active_ids, references = set(), set(), set(), set(), set()
        for page in pages:
            if not isinstance(page, dict) or not valid_id(page.get('id')) or page['id'] in page_ids:
                raise Invalid('Each page needs a unique identifier.')
            page_ids.add(page['id'])
        for gallery in galleries:
            if not isinstance(gallery, dict):
                raise Invalid('Invalid gallery.')
            if not valid_id(gallery.get('id')) or not valid_id(gallery.get('slug')):
                raise Invalid('Use letters, numbers, and hyphens for gallery addresses.')
            if gallery['id'] in ids or gallery['slug'] in slugs or gallery['slug'] in RESERVED:
                raise Invalid('Each gallery needs a unique, available address.')
            ids.add(gallery['id']); slugs.add(gallery['slug'])
            if not isinstance(gallery.get('title'), str) or not 1 <= len(gallery['title'].strip()) <= 80:
                raise Invalid('Give each gallery a name (up to 80 characters).')
            if not isinstance(gallery.get('visible'), bool):
                raise Invalid('Choose whether each gallery is shown on the site.')
            members = gallery.get('pageIds')
            if not isinstance(members, list) or len(members) > 200 or not all(isinstance(id, str) for id in members):
                raise Invalid('Invalid gallery page list.')
            if len(set(members)) != len(members) or not set(members).issubset(page_ids):
                raise Invalid('A gallery references a missing page or includes the same page twice.')
            if gallery['visible']:
                active_ids.update(members)
        for page in pages:
            if not isinstance(page.get('title'), str) or not 1 <= len(page['title'].strip()) <= 120:
                raise Invalid('Give each page a name (up to 120 characters).')
            if not isinstance(page.get('visible'), bool):
                raise Invalid('Choose whether each page is shown on the site.')
            rows = page.get('rows')
            if not isinstance(rows, list) or len(rows) > 12:
                raise Invalid(f"{page['title']}: use at most 12 rows.")
            active = page['visible'] and page['id'] in active_ids
            if active and (not rows or any(not row for row in rows)):
                raise Invalid(f"{page['title']}: fill or remove empty rows before showing this page on the site.")
            for row in rows:
                if not isinstance(row, list) or len(row) > 12:
                    raise Invalid(f"{page['title']}: use at most 12 photos per row.")
                for photo in row:
                    if not isinstance(photo, dict):
                        raise Invalid('Invalid photo.')
                    key = photo.get('yearFilename', '')
                    if not valid_photo_key(key):
                        raise Invalid('Invalid photo reference.')
                    for field, limit in [('title', 200), ('location', 200), ('date', 100)]:
                        if not isinstance(photo.get(field), str) or len(photo[field]) > limit:
                            raise Invalid(f'Photo {field} is missing or too long.')
                    if photo.get('aspect', 'horizontal') not in ['horizontal', 'vertical', 'square']:
                        raise Invalid('Invalid photo orientation.')
                    full = self.public / f'images/twodim/{key}_full.webp'
                    small = self.public / f'images/twodim/{key}_small.webp'
                    if key not in sources and not (full.is_file() and small.is_file()):
                        raise Invalid(f'Photo missing from the library: {key}')
                    if active:
                        references.add(key)
        return references, sources

    def save(self, catalog, revision, box_keys=None, box_revision=None):
        references, sources = self.validate(catalog)
        box_requested = box_keys is not None
        if box_requested:
            self.validate_box(box_keys, sources)
        with self.lock:
            current = self.catalog()
            current_box = self.box()
            if box_requested and box_revision != current_box['revision']:
                raise Conflict('The photo box changed in another window or tool. Export your draft, then reload before saving.')
            pages_changed = catalog != current['catalog']
            box_changed = box_requested and (box_keys != current_box['keys'] or not self.box_manifest.exists())
            if revision != current['revision']:
                raise Conflict('These pages changed in another window. Export your draft, then reload before saving.')
            if not pages_changed and not box_changed:
                return {**current, 'box': current_box, 'prepared': 0, 'unchanged': True}
            if not pages_changed:
                references = set()
            # Finish every conversion before committing page content.
            with tempfile.TemporaryDirectory(prefix='page-studio-') as temporary:
                pending, manifest_entries = [], []
                assets_path = self.root / 'localimages/photo-assets.json'
                assets = json.loads(assets_path.read_text()) if assets_path.exists() else {}
                jpegs = jpeg_sources(self.root)
                responsive_prepared = 0
                for key in sorted(references):
                    if not asset_current(self.root, key, assets.get(key), jpegs):
                        assets[key] = prepare_photo(self.root, key, public=Path(temporary), jpegs=jpegs)
                        responsive_prepared += 1
                pending.extend((path, self.public / path.relative_to(temporary))
                               for path in Path(temporary).rglob('*') if path.is_file())
                for key in sorted(references):
                    full = self.public / f'images/twodim/{key}_full.webp'
                    small = self.public / f'images/twodim/{key}_small.webp'
                    if full.is_file() and small.is_file():
                        continue
                    with Image.open(sources[key]) as opened:
                        image = opened.convert('RGB')
                        for kind, destination, quality in [('full', full, 90), ('small', small, 85)]:
                            if destination.is_file():
                                continue
                            output = image if kind == 'full' else image.resize(
                                (max(1, image.width // 4), max(1, image.height // 4)), Image.Resampling.LANCZOS)
                            staged = Path(temporary) / f'{len(pending)}.webp'
                            output.save(staged, 'WEBP', quality=quality)
                            pending.append((staged, destination))
                        manifest_entries.append({'fullUrl': f'/images/twodim/{quote(key, safe="/")}_full.webp',
                            'smallUrl': f'/images/twodim/{quote(key, safe="/")}_small.webp',
                            'aspectRatio': round(image.width / image.height, 4),
                            'vertical': image.width < image.height, 'year': key.split('/')[0]})
                box_pending, box_entries = self.prepare_box(box_keys, sources, Path(temporary)) if box_changed else ([], None)
                pending.extend(box_pending)
                # Reject edits by another tool made while photos were being prepared.
                if self.catalog()['revision'] != revision or (box_requested and self.box()['revision'] != box_revision):
                    raise Conflict('Saved content changed while preparing photos. Export your draft, then reload.')
                manifest_path = self.public / 'images/twodim/manifest.json'
                manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
                by_url = {item['fullUrl']: item for item in manifest}
                by_url.update({item['fullUrl']: item for item in manifest_entries})
                backup = self.root / 'localimages/page-studio-backups' / (
                    datetime.now().strftime('%Y%m%d-%H%M%S-') + uuid.uuid4().hex[:8] + '.json')
                if pages_changed:
                    atomic_write(backup, self.catalog_path.read_bytes())
                if box_changed:
                    atomic_write(backup.with_name('box-' + backup.name), encoded({
                        'keys': current_box['keys'],
                        'manifest': json.loads(self.box_manifest.read_text()) if self.box_manifest.exists() else None}))
                for staged, destination in pending:
                    atomic_write(destination, staged.read_bytes())
                if manifest_entries:
                    atomic_write(manifest_path, encoded(sorted(by_url.values(), key=lambda item: item['fullUrl'])))
                if responsive_prepared:
                    atomic_write(assets_path, encoded(assets))
                content = []
                if pages_changed:
                    content.append((self.catalog_path, encoded(catalog)))
                if box_changed:
                    content.append((self.box_manifest, encoded(box_entries)))
                originals = [(path, path.read_bytes() if path.exists() else None) for path, _ in content]
                try:
                    for path, data in content:
                        atomic_write(path, data)
                except OSError:
                    for path, data in originals:
                        if data is None:
                            path.unlink(missing_ok=True)
                        elif not path.exists() or path.read_bytes() != data:
                            atomic_write(path, data)
                    raise
                result = {**self.catalog(), 'box': self.box(), 'prepared': len(manifest_entries),
                          'boxPrepared': len(box_pending), 'unchanged': False}
                # Publish only visible metadata and approved compressed assets.
                # The full catalog/cache stays private, including all drafts.
                try:
                    publish(self.root, self.public, prepare=False, writer=atomic_write)
                except (OSError, ValueError) as error:
                    result['warning'] = 'Changes saved privately. Run npm run photos:publish, then rebuild to refresh public previews.'
                    return result
                # The canonical save succeeds even if a disposable build cannot be refreshed.
                build = self.root / 'build'
                if build.is_dir():
                    try:
                        publish(self.root, build, prepare=False, writer=atomic_write)
                    except (OSError, ValueError):
                        result['warning'] = 'Changes saved locally. Rebuild the site to refresh the separate build preview.'
                return result



@lru_cache(maxsize=256)
def thumbnail(path, modified):
    with Image.open(path) as image:
        image.thumbnail((360, 360), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, 'WEBP', quality=75)
        return buffer.getvalue()


def handler_for(studio):
    class Handler(BaseHTTPRequestHandler):
        def send(self, status, body, content_type='application/json'):
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(body)

        def host_valid(self):
            port = self.server.server_address[1]
            return self.headers.get('Host') in [f'127.0.0.1:{port}', f'localhost:{port}']

        def do_GET(self):
            if not self.host_valid():
                return self.send(403, encoded({'error': 'Open the editor using its localhost address.'}))
            url = urlsplit(self.path)
            path = unquote(url.path)
            try:
                if path == '/api/catalog':
                    return self.send(200, encoded(studio.catalog()))
                if path == '/api/box':
                    return self.send(200, encoded(studio.box()))
                if path == '/api/library':
                    return self.send(200, encoded({'photos': studio.library()}))
                if path in ['/api/thumb', '/api/photo']:
                    key = parse_qs(url.query).get('key', [''])[0]
                    source = studio.sources().get(key) or studio.box_file(key)
                    if source is None:
                        return self.send(404, encoded({'error': 'Photo not found.'}))
                    data = thumbnail(str(source), source.stat().st_mtime_ns) if path == '/api/thumb' else source.read_bytes()
                    return self.send(200, data, 'image/webp')
                if path in ['/', '/index.html', '/studio.js', '/model.js', '/organizer.js', '/box-studio.js', '/styles.css']:
                    file = UI_ROOT / ('index.html' if path in ['/', '/index.html'] else path[1:])
                elif path == '/preview':
                    file = studio.root / 'build/index.html'
                    if not file.exists():
                        return self.send(404, b'Build the site once with npm run build, then open this preview again.', 'text/plain')
                else:
                    if any(part.startswith('.') for part in Path(path).parts):
                        return self.send(404, b'Not found', 'text/plain')
                    file = None
                    for base in [studio.public, studio.root / 'build']:
                        candidate = (base / path.lstrip('/')).resolve()
                        if base.resolve() in candidate.parents and candidate.is_file():
                            file = candidate
                            break
                    if file is None:
                        return self.send(404, b'Not found', 'text/plain')
                content_type = mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
                self.send(200, file.read_bytes(), content_type)
            except (OSError, ValueError) as error:
                self.send(500, encoded({'error': str(error)}))

        def do_POST(self):
            if not self.host_valid() or self.headers.get('X-Page-Studio') != '1':
                return self.send(403, encoded({'error': 'Save from the local Page Studio window.'}))
            origin = self.headers.get('Origin')
            if origin and origin != f'http://{self.headers.get("Host")}':
                return self.send(403, encoded({'error': 'Invalid request origin.'}))
            if self.path != '/api/save':
                return self.send(404, encoded({'error': 'Not found.'}))
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 2_000_000:
                    raise Invalid('The draft is too large or empty.')
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise Invalid('Invalid save request.')
                result = studio.save(payload.get('catalog'), payload.get('revision'),
                                     payload.get('boxKeys'), payload.get('boxRevision'))
                self.send(200, encoded(result))
            except Conflict as error:
                self.send(409, encoded({'error': str(error)}))
            except (Invalid, ValueError, KeyError, TypeError) as error:
                self.send(400, encoded({'error': str(error)}))
            except Exception as error:
                self.send(500, encoded({'error': f'Could not save the changes: {error}'}))

        def log_message(self, format, *args):
            if args and str(args[0]).startswith('POST'):
                super().log_message(format, *args)
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8767)
    args = parser.parse_args()
    studio = Studio(PROJECT_ROOT)
    studio.catalog()
    publish(PROJECT_ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), handler_for(studio))
    print(f'Page Studio: http://127.0.0.1:{args.port}', flush=True)
    print('Draft edits stay in the editor. Save pages applies them locally; it does not deploy the site.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
