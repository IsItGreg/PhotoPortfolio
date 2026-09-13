"""Box selections use disposable libraries; no real portfolio content is saved."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from server import Studio, Invalid, Conflict, encoded, atomic_write


class BoxStudioTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.studio = Studio(self.root)
        self.catalog = {'version': 2, 'pages': [], 'galleries': []}
        atomic_write(self.studio.catalog_path, encoded(self.catalog))
        for key in ['2025/a', '2026/folder/b', '2026/new']:
            path = self.root / f'localimages/webp/{key}.webp'
            path.parent.mkdir(parents=True, exist_ok=True)
            Image.new('RGB', (80, 120), 'red').save(path, 'WEBP')
        self.box_dir = self.studio.box_manifest.parent
        self.entries = []
        for key in ['2025/a', '2026/folder/b']:
            path = self.box_dir / f'{key}.webp'
            path.parent.mkdir(parents=True, exist_ok=True)
            Image.new('RGB', (120, 130), 'white').save(path, 'WEBP')
            self.entries.append({'url': f'/images/threedimbox/{key}.webp', 'aspectRatio': round(120/130,4), 'vertical': True})
        atomic_write(self.studio.box_manifest, encoded(self.entries))
        self.page_bytes = self.studio.catalog_path.read_bytes()
        self.box_bytes = self.studio.box_manifest.read_bytes()
        self.page_revision = self.studio.catalog()['revision']
        self.box_revision = self.studio.box()['revision']

    def save_box(self, keys):
        return self.studio.save(self.catalog, self.page_revision, keys, self.box_revision)

    def test_reads_actual_flip_order_without_writing_or_recompressing(self):
        self.assertEqual(self.studio.box()['keys'], ['2026/folder/b', '2025/a'])
        with patch('server.add_white_border', side_effect=AssertionError('No conversion needed')):
            result = self.save_box(['2026/folder/b', '2025/a'])
        self.assertTrue(result['unchanged'])
        self.assertEqual(self.studio.box_manifest.read_bytes(), self.box_bytes)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.page_bytes)
        self.assertFalse((self.root / 'localimages/page-studio-backups').exists())

    def test_box_save_preserves_pages_and_originals_and_refreshes_build_in_display_order(self):
        (self.root / 'build').mkdir()
        original = (self.root / 'localimages/webp/2026/new.webp').read_bytes()
        existing = (self.box_dir / '2025/a.webp').read_bytes()
        with patch('server.prepare_photo', side_effect=AssertionError('Do not prepare gallery images for box edits')):
            result = self.save_box(['2026/new', '2025/a'])
        self.assertEqual(result['box']['keys'], ['2026/new', '2025/a'])
        self.assertEqual(result['boxPrepared'], 1)
        self.assertEqual(result['revision'], self.page_revision)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.page_bytes)
        self.assertEqual((self.root / 'localimages/webp/2026/new.webp').read_bytes(), original)
        self.assertEqual((self.box_dir / '2025/a.webp').read_bytes(), existing)
        self.assertTrue((self.box_dir / '2026/folder/b.webp').is_file())
        self.assertEqual([p['url'] for p in json.loads(self.studio.box_manifest.read_text())], ['/images/threedimbox/2025/a.webp', '/images/threedimbox/2026/new.webp'])
        with Image.open(self.box_dir / '2026/new.webp') as image:
            self.assertEqual(image.size, (120,130))
            self.assertGreater(min(image.getpixel((0,0))), 245)
        self.assertEqual((self.root / 'build/images/threedimbox/manifest.json').read_bytes(), self.studio.box_manifest.read_bytes())
        self.assertTrue((self.root / 'build/images/threedimbox/2026/new.webp').exists())
        backup = next((self.root / 'localimages/page-studio-backups').glob('box-*.json'))
        self.assertEqual(json.loads(backup.read_text())['manifest'], self.entries)

    def test_removing_every_photo_leaves_a_valid_empty_box_and_keeps_prepared_files(self):
        self.save_box([])
        self.assertEqual(self.studio.box()['keys'], [])
        self.assertEqual(json.loads(self.studio.box_manifest.read_text()), [])
        self.assertTrue((self.box_dir / '2025/a.webp').exists())

    def test_reordering_reuses_bordered_files_instead_of_converting_again(self):
        with patch('server.add_white_border', side_effect=AssertionError('Already prepared')):
            self.save_box(['2025/a', '2026/folder/b'])
        self.assertEqual(self.studio.box()['keys'], ['2025/a', '2026/folder/b'])

    def test_missing_library_original_can_remain_or_be_removed_if_its_box_export_exists(self):
        (self.root / 'localimages/webp/2025/a.webp').unlink()
        self.save_box(['2025/a'])
        self.assertEqual(self.studio.box()['keys'], ['2025/a'])

    def test_invalid_keys_and_duplicate_photos_never_change_content(self):
        outside = self.root / 'outside.webp'
        Image.new('RGB', (10,10)).save(outside, 'WEBP')
        (self.box_dir / '2025/escaped.webp').symlink_to(outside)
        for keys in [['2025/a', '2025/a'], ['2026/../a'], ['2026/missing'], ['2025/escaped'], '2025/a', [5], ['2026/%2e%2e/a']]:
            with self.subTest(keys=keys), self.assertRaises(Invalid):
                self.save_box(keys)
        self.assertEqual(self.studio.box_manifest.read_bytes(), self.box_bytes)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.page_bytes)

    def test_other_tool_changes_are_detected_before_conversions(self):
        atomic_write(self.studio.box_manifest, encoded(list(reversed(self.entries))))
        with patch('server.add_white_border', side_effect=AssertionError('No conversion')), self.assertRaises(Conflict):
            self.save_box(['2026/new'])
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.page_bytes)

    def test_conversion_failure_does_not_save_box_or_page_changes(self):
        draft = copy.deepcopy(self.catalog)
        draft['pages'].append({'id':'empty','title':'Draft','visible':False,'rows':[[]]})
        with patch('server.add_white_border', side_effect=OSError('Disk full')), self.assertRaises(OSError):
            self.studio.save(draft, self.page_revision, ['2026/new'], self.box_revision)
        self.assertEqual(self.studio.box_manifest.read_bytes(), self.box_bytes)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.page_bytes)

    def test_failed_manifest_commit_restores_the_page_catalog(self):
        draft = copy.deepcopy(self.catalog)
        draft['pages'].append({'id':'empty','title':'Draft','visible':False,'rows':[[]]})
        def fail_box(path, data):
            if path == self.studio.box_manifest:
                raise OSError('Read only manifest')
            atomic_write(path, data)
        with patch('server.atomic_write', side_effect=fail_box), self.assertRaises(OSError):
            self.studio.save(draft, self.page_revision, ['2025/a'], self.box_revision)
        self.assertEqual(self.studio.box_manifest.read_bytes(), self.box_bytes)
        self.assertEqual(self.studio.catalog_path.read_bytes(), self.page_bytes)

    def test_build_failure_returns_success_with_preview_warning(self):
        (self.root / 'build').mkdir()
        def fail_build(path, data):
            if self.root / 'build' in path.parents:
                raise OSError('Read only build')
            atomic_write(path, data)
        with patch('server.atomic_write', side_effect=fail_build):
            result = self.save_box(['2025/a'])
        self.assertIn('warning', result)
        self.assertEqual(result['box']['keys'], ['2025/a'])
