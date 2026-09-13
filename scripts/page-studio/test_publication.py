import copy
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from photo_catalog import load_catalog, public_catalog, atomic_write, encoded
from publication import publish, verify_build, local_public_file, verify_compressed


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.originals = {}
        for key in ('shown', 'hidden', 'orphan', 'box'):
            path = self.root / f'localimages/jpg/2026/{key}.jpg'
            path.parent.mkdir(parents=True, exist_ok=True)
            exif = Image.Exif()
            exif[305] = 'Private editing metadata'
            Image.new('RGB', (80, 60), 'orange').save(path, quality=98, exif=exif)
            self.originals[path] = path.read_bytes()
        def page(key, visible):
            return {'id': key, 'title': key, 'visible': visible, 'privateNote': 'do not publish', 'rows': [[{
                'yearFilename': f'2026/{key}', 'title': key, 'location': '', 'date': '', 'privateNote': 'private'}]]}
        self.catalog = {'version': 2, 'pages': [page('shown', True), page('hidden', False), page('orphan', True)],
                        'galleries': [{'id': 'gallery', 'slug': 'gallery', 'title': 'Gallery', 'visible': True,
                                       'pageIds': ['shown', 'hidden'], 'privateNote': 'private'}]}
        atomic_write(self.root / 'public/photo-pages.json', encoded(self.catalog))
        box = self.root / 'public/images/threedimbox/2026/box.webp'
        box.parent.mkdir(parents=True)
        Image.new('RGB', (80, 90), 'white').save(box, 'WEBP', quality=85)
        atomic_write(box.parents[1] / 'manifest.json', encoded([{
            'url': '/images/threedimbox/2026/box.webp', 'aspectRatio': 80/90, 'vertical': True}]))

    def test_private_migration_is_lossless_and_never_reimports_public_subset(self):
        original = (self.root / 'public/photo-pages.json').read_bytes()
        self.assertEqual(load_catalog(self.root), self.catalog)
        private = self.root / 'localimages/photo-pages.json'
        self.assertEqual(private.read_bytes(), original)
        publish(self.root)
        self.assertEqual(load_catalog(self.root), self.catalog)
        self.assertEqual(private.read_bytes(), original)

    def test_public_projection_excludes_hidden_unassigned_and_editor_only_fields(self):
        result = public_catalog(self.catalog)
        self.assertEqual([p['id'] for p in result['pages']], ['shown'])
        self.assertEqual(result['galleries'][0]['pageIds'], ['shown'])
        self.assertNotIn('private', json.dumps(result))
        hidden_gallery = copy.deepcopy(self.catalog)
        hidden_gallery['galleries'][0]['visible'] = False
        self.assertEqual(public_catalog(hidden_gallery)['pages'], [])

    def test_shared_visible_page_is_published_once(self):
        self.catalog['galleries'].append({**self.catalog['galleries'][0], 'id': 'second', 'slug': 'second'})
        self.assertEqual(len(public_catalog(self.catalog)['pages']), 1)

    def test_build_has_only_selected_compressed_photos_and_preserves_originals(self):
        publish(self.root)
        stray = self.root / 'build/images/original.jpg'
        stray.parent.mkdir(parents=True)
        stray.write_bytes(next(iter(self.originals.values())))
        sample = self.root / 'build/testimgs/sample.jpg'
        sample.parent.mkdir()
        sample.write_bytes(stray.read_bytes())
        report = publish(self.root, self.root / 'build', prepare=False)
        self.assertEqual(report['galleryPhotos'], 1)
        self.assertEqual(report['boxPhotos'], 1)
        self.assertFalse(stray.exists())
        self.assertFalse(sample.exists())
        self.assertFalse(list((self.root / 'build').rglob('*.jpg')))
        for path in (self.root / 'build/images').rglob('*.webp'):
            verify_compressed(path)
            self.assertNotIn(path.read_bytes(), self.originals.values())
        for path, before in self.originals.items():
            self.assertEqual(path.read_bytes(), before)
        verify_build(self.root)

    def test_hiding_a_previously_visible_page_prunes_build_only(self):
        publish(self.root)
        publish(self.root, self.root / 'build', prepare=False)
        cached = list((self.root / 'public/images/optimized').rglob('*.webp'))
        draft = copy.deepcopy(self.catalog)
        draft['pages'][0]['visible'] = False
        atomic_write(self.root / 'localimages/photo-pages.json', encoded(draft))
        publish(self.root)
        publish(self.root, self.root / 'build', prepare=False)
        self.assertFalse((self.root / 'build/images/optimized').exists())
        self.assertTrue(all(path.exists() for path in cached))
        self.assertEqual(json.loads((self.root / 'build/photo-assets.json').read_text()), {})
        verify_build(self.root)

    def test_missing_photo_fails_before_replacing_existing_build(self):
        publish(self.root)
        publish(self.root, self.root / 'build', prepare=False)
        before = (self.root / 'build/photo-pages.json').read_bytes()
        next((self.root / 'public/images/optimized').rglob('*.webp')).unlink()
        with self.assertRaises(ValueError):
            publish(self.root, self.root / 'build', prepare=False)
        self.assertEqual((self.root / 'build/photo-pages.json').read_bytes(), before)

    def test_unsafe_paths_and_originals_are_rejected(self):
        for url in ['/images/optimized/../../photo-pages.json', 'https://example.com/images/optimized/a.webp']:
            with self.assertRaises(ValueError):
                local_public_file(self.root, url, '/images/optimized/')
        path = self.root / 'public/images/optimized/pretend.webp'
        path.parent.mkdir(parents=True)
        path.write_bytes(next(iter(self.originals.values())))
        with self.assertRaises(ValueError):
            verify_compressed(path)

    def test_source_map_guard(self):
        publish(self.root)
        publish(self.root, self.root / 'build', prepare=False)
        (self.root / 'build/leaked.js.map').write_text('{}')
        with self.assertRaises(ValueError):
            verify_build(self.root)

    def test_partial_metadata_failure_restores_previous_complete_preview(self):
        publish(self.root)
        publish(self.root, self.root / 'build', prepare=False)
        before = {p.relative_to(self.root / 'build'): p.read_bytes()
                  for p in (self.root / 'build').rglob('*') if p.is_file()}
        draft = copy.deepcopy(self.catalog)
        draft['pages'][0]['visible'] = False
        atomic_write(self.root / 'localimages/photo-pages.json', encoded(draft))
        def fail_second_metadata(path, data):
            if path == self.root / 'build/photo-assets.json':
                raise OSError('Simulated write failure')
            atomic_write(path, data)
        with self.assertRaises(OSError):
            publish(self.root, self.root / 'build', prepare=False, writer=fail_second_metadata)
        after = {p.relative_to(self.root / 'build'): p.read_bytes()
                 for p in (self.root / 'build').rglob('*') if p.is_file()}
        self.assertEqual(before, after)
