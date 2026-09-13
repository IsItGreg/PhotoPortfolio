import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from server import Studio, Invalid, Conflict, encoded, atomic_write, migrate_catalog


class StudioTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.studio = Studio(self.root)
        self.source = self.root / 'localimages/webp/2026'
        self.source.mkdir(parents=True)
        for name in ['old', 'new']:
            Image.new('RGB', (40, 60), 'green').save(self.source / f'{name}.webp', 'WEBP')
        self.photo = {'yearFilename': '2026/old', 'title': 'Original', 'location': '', 'date': '', 'aspect': 'vertical'}
        self.catalog = {'version': 1, 'galleries': [{'id': 'nyc', 'slug': 'nyc', 'title': 'NYC', 'pages': [{'rows': [[self.photo]]}]}]}
        self.legacy = copy.deepcopy(self.catalog)
        self.catalog = migrate_catalog(self.catalog)
        self.studio.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.studio.catalog_path.write_bytes(encoded(self.catalog))
        self.assets = self.studio.public / 'images/twodim/2026'
        self.assets.mkdir(parents=True)
        for kind in ['full', 'small']:
            Image.new('RGB', (40, 60), 'red').save(self.assets / f'old_{kind}.webp', 'WEBP')
        self.manifest = self.assets.parent / 'manifest.json'
        self.manifest.write_bytes(encoded([{'fullUrl': '/images/twodim/2026/old_full.webp', 'smallUrl': '/images/twodim/2026/old_small.webp', 'aspectRatio': 0.6667, 'vertical': True, 'year': '2026'}]))
        self.before = self.studio.catalog_path.read_bytes()
        self.revision = self.studio.catalog()['revision']

    def draft_with_new_photo(self):
        draft = copy.deepcopy(self.catalog)
        photo = dict(self.photo, yearFilename='2026/new', title='New')
        draft['pages'][0]['rows'][0].append(photo)
        return draft

    def test_reading_library_does_not_publish_new_photos(self):
        library = self.studio.library()
        self.assertEqual({p['key'] for p in library}, {'2026/old', '2026/new'})
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.before)
        self.assertFalse((self.assets / 'new_full.webp').exists())

    def test_nested_folders_keep_identity_and_save_nested_variants(self):
        folder = self.source / 'infrared' / 'evening'
        folder.mkdir(parents=True)
        Image.new('RGB', (60, 40), 'blue').save(folder / 'old.webp', 'WEBP')
        library = {item['key']: item for item in self.studio.library()}
        self.assertEqual(set(library), {'2026/old', '2026/new', '2026/infrared/evening/old'})
        self.assertEqual(library['2026/infrared/evening/old']['year'], '2026')
        self.assertEqual(library['2026/infrared/evening/old']['group'], 'infrared/evening')
        self.assertEqual(library['2026/old']['group'], '')
        flat_before = (self.assets / 'old_full.webp').read_bytes()
        draft = copy.deepcopy(self.catalog)
        draft['pages'][0]['rows'][0].append(library['2026/infrared/evening/old']['photo'])
        (self.root / 'build').mkdir()
        result = self.studio.save(draft, self.revision)
        self.assertEqual(result['prepared'], 1)
        self.assertTrue((self.assets / 'infrared/evening/old_small.webp').exists())
        self.assertTrue((self.root / 'build/images/twodim/2026/infrared/evening/old_small.webp').exists())
        self.assertEqual((self.assets / 'old_full.webp').read_bytes(), flat_before)
        self.assertIn('/images/twodim/2026/infrared/evening/old_full.webp', [p['fullUrl'] for p in json.loads(self.manifest.read_text())])

    def test_nested_reference_validation_rejects_traversal_and_escaped_sources(self):
        outside = self.root / 'outside.webp'
        Image.new('RGB', (20, 20)).save(outside, 'WEBP')
        (self.source / 'escaped.webp').symlink_to(outside)
        self.assertNotIn('2026/escaped', self.studio.sources())
        for key in ['2026/infrared/../old', '2026//old', '/2026/old', '2026/.hidden/old', '2026/infrared\\old']:
            draft = copy.deepcopy(self.catalog)
            draft['pages'][0]['rows'][0][0]['yearFilename'] = key
            with self.subTest(key=key), self.assertRaises(Invalid):
                self.studio.save(draft, self.revision)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.before)

    def test_save_prepares_only_selected_photos_and_preserves_existing_assets(self):
        old_asset = (self.assets / 'old_full.webp').read_bytes()
        Image.new('RGB', (40, 60)).save(self.source / 'unselected.webp', 'WEBP')
        (self.root / 'build').mkdir()
        draft = self.draft_with_new_photo()
        result = self.studio.save(draft, self.revision)
        self.assertEqual(result['catalog'], draft)
        self.assertEqual(result['prepared'], 1)
        self.assertNotEqual(result['revision'], self.revision)
        self.assertEqual((self.assets / 'old_full.webp').read_bytes(), old_asset)
        self.assertFalse((self.assets / 'unselected_full.webp').exists())
        with Image.open(self.assets / 'new_small.webp') as image:
            self.assertEqual(image.size, (10, 15))
        self.assertEqual(len(json.loads(self.manifest.read_text())), 2)
        backups = list((self.root / 'localimages/page-studio-backups').glob('*.json'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(json.loads(backups[0].read_text()), self.catalog)
        self.assertEqual((self.root / 'build/photo-pages.json').read_bytes(), self.studio.catalog_path.read_bytes())
        self.assertTrue((self.root / 'build/images/twodim/2026/new_small.webp').exists())

    def test_stale_save_cannot_overwrite_newer_edit(self):
        first = copy.deepcopy(self.catalog)
        first['galleries'][0]['title'] = 'Updated NYC'
        self.studio.save(first, self.revision)
        with self.assertRaises(Conflict):
            self.studio.save(self.draft_with_new_photo(), self.revision)
        self.assertEqual(self.studio.catalog()['catalog'], first)
        self.assertFalse((self.assets / 'new_full.webp').exists())

    def test_invalid_drafts_leave_content_and_assets_untouched(self):
        invalid = []
        draft = self.draft_with_new_photo(); draft['pages'][0]['rows'][0][1]['yearFilename'] = '2026/../../outside'; invalid.append(draft)
        draft = self.draft_with_new_photo(); draft['pages'][0]['rows'][0][1]['yearFilename'] = '2026/missing'; invalid.append(draft)
        draft = copy.deepcopy(self.catalog); draft['pages'][0]['rows'].append([]); invalid.append(draft)
        draft = copy.deepcopy(self.catalog); draft['galleries'].append(copy.deepcopy(draft['galleries'][0])); invalid.append(draft)
        draft = copy.deepcopy(self.catalog); draft['galleries'][0]['slug'] = 'old'; invalid.append(draft)
        for draft in invalid:
            with self.subTest(draft=draft), self.assertRaises(Invalid):
                self.studio.save(draft, self.revision)
            self.assertEqual(self.studio.catalog_path.read_bytes(), self.before)
            self.assertFalse((self.assets / 'new_full.webp').exists())

    def test_failed_image_processing_never_commits_page_content(self):
        with patch.object(Image.Image, 'save', side_effect=OSError('Disk full')):
            with self.assertRaises(OSError):
                self.studio.save(self.draft_with_new_photo(), self.revision)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.before)
        self.assertFalse((self.assets / 'new_full.webp').exists())

    def test_build_preview_failure_does_not_report_a_successful_save_as_failed(self):
        (self.root / 'build').mkdir()
        def write_with_readonly_build(path, data):
            if self.studio.root / 'build' in Path(path).parents:
                raise PermissionError('Read-only build')
            atomic_write(path, data)
        draft = self.draft_with_new_photo()
        with patch('server.atomic_write', side_effect=write_with_readonly_build):
            result = self.studio.save(draft, self.revision)
        self.assertEqual(result['catalog'], draft)
        self.assertIn('warning', result)
        self.assertEqual(self.studio.catalog()['catalog'], draft)

    def test_unchanged_save_does_not_recompress_or_create_backups(self):
        result = self.studio.save(copy.deepcopy(self.catalog), self.revision)
        self.assertTrue(result['unchanged'])
        self.assertFalse((self.root / 'localimages/page-studio-backups').exists())
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.before)

    def test_legacy_migration_is_read_only_and_keeps_the_raw_revision(self):
        raw = encoded(self.legacy)
        self.studio.catalog_path.write_bytes(raw)
        data = self.studio.catalog()
        self.assertEqual(data['catalog'], self.catalog)
        self.assertEqual(data['revision'], hashlib.sha256(raw).hexdigest())
        self.studio.library()
        self.assertTrue(self.studio.save(data['catalog'], data['revision'])['unchanged'])
        self.assertEqual(self.studio.catalog_path.read_bytes(), raw)
        draft = copy.deepcopy(data['catalog'])
        draft['pages'][0]['title'] = 'My first page'
        self.studio.save(draft, data['revision'])
        self.assertEqual(json.loads(self.studio.catalog_path.read_text())['version'], 2)

    def test_hidden_and_unassigned_pages_save_without_preparing_assets(self):
        draft = self.draft_with_new_photo()
        draft['pages'][0]['visible'] = False
        draft['pages'].append({'id': 'blank', 'title': 'Blank', 'visible': False, 'rows': [[]]})
        result = self.studio.save(draft, self.revision)
        self.assertEqual(result['prepared'], 0)
        self.assertFalse((self.assets / 'new_full.webp').exists())
        # A shown page only becomes active when attached to a shown gallery.
        draft['pages'][0]['visible'] = True
        draft['galleries'][0]['pageIds'] = []
        self.assertEqual(self.studio.save(draft, result['revision'])['prepared'], 0)

    def test_shared_pages_prepare_once_and_global_hiding_preserves_memberships(self):
        draft = self.draft_with_new_photo()
        draft['galleries'].insert(0, {'id': 'favorites', 'slug': 'favorites', 'title': 'Favorites', 'visible': True, 'pageIds': ['nyc-page-1']})
        result = self.studio.save(draft, self.revision)
        self.assertEqual(result['prepared'], 1)
        self.assertEqual([g['id'] for g in result['catalog']['galleries']], ['favorites', 'nyc'])
        draft['pages'][0]['visible'] = False
        references, _ = self.studio.validate(draft)
        self.assertEqual(references, set())
        self.assertEqual([g['pageIds'] for g in draft['galleries']], [['nyc-page-1'], ['nyc-page-1']])

    def test_invalid_shared_references_and_visibility_are_rejected(self):
        invalid = []
        draft = copy.deepcopy(self.catalog); draft['galleries'][0]['pageIds'].append('missing'); invalid.append(draft)
        draft = copy.deepcopy(self.catalog); draft['galleries'][0]['pageIds'] *= 2; invalid.append(draft)
        draft = copy.deepcopy(self.catalog); draft['pages'].append(copy.deepcopy(draft['pages'][0])); invalid.append(draft)
        draft = copy.deepcopy(self.catalog); draft['pages'][0]['visible'] = 'false'; invalid.append(draft)
        for draft in invalid:
            with self.subTest(draft=draft), self.assertRaises(Invalid):
                self.studio.save(draft, self.revision)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.before)

    def test_blank_pages_may_be_saved_until_they_are_shown_on_the_site(self):
        draft = copy.deepcopy(self.catalog)
        draft['pages'][0]['rows'] = [[]]
        draft['galleries'][0]['visible'] = False
        result = self.studio.save(draft, self.revision)
        draft['galleries'][0]['visible'] = True
        with self.assertRaises(Invalid):
            self.studio.save(draft, result['revision'])
        draft['pages'][0]['visible'] = False
        self.studio.save(draft, result['revision'])


if __name__ == '__main__':
    unittest.main()
