"""Private editorial catalog and explicit public projection; no network access."""
import copy
import json
import os
from pathlib import Path
import tempfile
from image_paths import valid_photo_key


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == data:
        return
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as file:
        file.write(data)
        temporary = Path(file.name)
    try:
        os.chmod(temporary, 0o644)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def catalog_path(root):
    return Path(root) / 'localimages/photo-pages.json'


def load_catalog(root):
    path = catalog_path(root)
    if not path.exists():
        legacy = Path(root) / 'public/photo-pages.json'
        if not legacy.is_file():
            raise ValueError('No local page catalog. Restore localimages/photo-pages.json from your private backup.')
        raw = legacy.read_bytes()
        # Validate before preserving the one-time migration. Never replace an
        # existing private catalog with a smaller public projection.
        public_catalog(json.loads(raw))
        atomic_write(path, raw)
    return json.loads(path.read_text())


def public_catalog(value):
    value = copy.deepcopy(value)
    if value.get('version') == 1:
        pages, galleries = [], []
        for gallery in value['galleries']:
            ids = []
            for i, page in enumerate(gallery['pages']):
                id = f'{gallery["id"]}-page-{i + 1}'
                ids.append(id)
                pages.append({'id': id, 'title': f'{gallery["title"]} — Page {i + 1}',
                              'visible': True, 'rows': page['rows']})
            galleries.append({**gallery, 'visible': True, 'pageIds': ids})
        value = {'version': 2, 'pages': pages, 'galleries': galleries}
    if value.get('version') != 2 or not isinstance(value.get('pages'), list) or not isinstance(value.get('galleries'), list):
        raise ValueError('Invalid page catalog')
    pages = {page['id']: page for page in value['pages']}
    if len(pages) != len(value['pages']):
        raise ValueError('Duplicate page IDs')
    selected, galleries = set(), []
    for gallery in value['galleries']:
        if gallery.get('visible') is not True:
            continue
        ids = gallery['pageIds']
        if len(set(ids)) != len(ids) or any(id not in pages for id in ids):
            raise ValueError('Invalid gallery page references')
        ids = [id for id in ids if pages[id].get('visible') is True]
        if not ids:
            continue
        selected.update(ids)
        galleries.append({**{key: gallery[key] for key in ('id', 'title', 'slug')}, 'visible': True, 'pageIds': ids})
    result = []
    for page in value['pages']:
        if page['id'] not in selected:
            continue
        rows = []
        if not page.get('rows') or any(not row for row in page['rows']):
            raise ValueError('Visible pages must have nonempty photo rows')
        for row in page['rows']:
            output = []
            for photo in row:
                if not valid_photo_key(photo.get('yearFilename')):
                    raise ValueError('Invalid public photo key')
                output.append({key: photo[key] for key in ('yearFilename', 'title', 'location', 'date', 'aspect') if key in photo})
            rows.append(output)
        result.append({'id': page['id'], 'title': page['title'], 'visible': True, 'rows': rows})
    return {'version': 2, 'pages': result, 'galleries': galleries}


def visible_photo_keys(catalog):
    return {photo['yearFilename'] for page in public_catalog(catalog)['pages']
            for row in page['rows'] for photo in row}
