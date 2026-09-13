"""Exercise the original image tools using temporary photo libraries only."""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import quote
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'localimages/scripts'))
import convert_to_webp as converter
import two_dim_image_prep as twodim
import three_dim_image_prep as box


class ImageToolTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.jpg = self.root / 'jpg'
        self.webp = self.root / 'webp'
        self.site = self.root / 'public'
        for relative, color in [('2025/old.jpg', 'red'), ('2026/same.jpg', 'green'), ('2026/infrared/same.jpg', 'blue'), ('2026/infrared/evening/late.jpg', 'yellow')]:
            path = self.jpg / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            Image.new('RGB', (40, 60), color).save(path, 'JPEG')
        for module in [converter, twodim, box]:
            self.enter_patch(patch.object(module, 'WEBP_DIR', self.webp))
        self.enter_patch(patch.object(converter, 'JPG_DIR', self.jpg))
        self.enter_patch(patch.object(twodim, 'TWODIM_DIR', self.site / 'twodim'))
        self.enter_patch(patch.object(box, 'THREEDIMBOX_DIR', self.site / 'box'))
        self.enter_patch(contextlib.redirect_stdout(io.StringIO()))

    def enter_patch(self, manager):
        manager.__enter__()
        self.addCleanup(manager.__exit__, None, None, None)

    def convert_fixture(self):
        self.assertTrue(converter.convert_images('2025'))
        self.assertTrue(converter.convert_images('2026'))

    def test_converter_mirrors_subfolders_and_does_not_recompress_existing_files(self):
        self.convert_fixture()
        files = {p.relative_to(self.webp).as_posix(): p.read_bytes() for p in self.webp.rglob('*.webp')}
        self.assertEqual(set(files), {'2025/old.webp', '2026/same.webp', '2026/infrared/same.webp', '2026/infrared/evening/late.webp'})
        self.assertNotEqual(files['2026/same.webp'], files['2026/infrared/same.webp'])
        self.assertTrue(converter.convert_images('2026/infrared'))
        self.assertEqual(files, {p.relative_to(self.webp).as_posix(): p.read_bytes() for p in self.webp.rglob('*.webp')})
        self.assertFalse(converter.convert_images('../outside'))

    def test_converter_accepts_a_group_on_the_command_line(self):
        with patch.object(sys, 'argv', ['convert_to_webp.py', '2026/infrared']), self.assertRaises(SystemExit) as exit_result:
            converter.main()
        self.assertEqual(exit_result.exception.code, 0)
        self.assertTrue((self.webp / '2026/infrared/evening/late.webp').exists())
        self.assertFalse((self.webp / '2026/same.webp').exists())

    def test_twodim_export_and_manifest_preserve_flat_and_nested_paths(self):
        self.convert_fixture()
        twodim.main()
        manifest = json.loads((self.site / 'twodim/manifest.json').read_text())
        self.assertEqual(len(manifest), 4)
        self.assertIn('/images/twodim/2026/infrared/same_full.webp', [p['fullUrl'] for p in manifest])
        self.assertIn('/images/twodim/2026/same_full.webp', [p['fullUrl'] for p in manifest])
        with Image.open(self.site / 'twodim/2026/infrared/evening/late_small.webp') as image:
            self.assertEqual(image.size, (10, 15))
        self.assertEqual({p['year'] for p in manifest}, {'2025', '2026'})

    def test_box_selection_and_deselection_preserve_other_folders(self):
        self.convert_fixture()
        images = box.get_all_webp_images()['2026']
        self.assertEqual({p['group'] for p in images}, {'', 'infrared', 'infrared/evening'})
        selected = ['2025/old.webp', '2026/same.webp', '2026/infrared/same.webp']
        self.assertEqual(box.apply_selection(selected)['copied'], 3)
        self.assertEqual(box.get_existing_images(), set(selected))
        flat_before = (self.site / 'box/2026/same.webp').read_bytes()
        self.assertEqual(box.apply_selection(selected[:-1])['removed'], 1)
        self.assertEqual((self.site / 'box/2026/same.webp').read_bytes(), flat_before)
        self.assertEqual(box.get_existing_images(), set(selected[:-1]))
        self.assertTrue(box.apply_selection(selected[:-1])['no_change'])
        manifest = json.loads((self.site / 'box/manifest.json').read_text())
        self.assertEqual(len(manifest), 2)

    def test_box_lists_groups_without_decoding_photos_and_serves_nested_thumbnails(self):
        self.convert_fixture()
        def request(path):
            handler = object.__new__(box.RequestHandler)
            handler.path = path
            handler.wfile = io.BytesIO()
            handler.send_response = Mock()
            handler.send_header = Mock()
            handler.end_headers = Mock()
            handler.send_error = Mock()
            handler.do_GET()
            return handler
        with patch.object(box, 'create_thumbnail_base64', side_effect=AssertionError('List should not decode photos')):
            listing = request('/api/images')
        data = json.loads(listing.wfile.getvalue())
        self.assertEqual(len(data['images_by_year']['2026']), 3)
        thumbnail = request('/api/thumbnail?key=' + quote('2026/infrared/same.webp', safe=''))
        thumbnail.send_response.assert_called_once_with(200)
        with Image.open(io.BytesIO(thumbnail.wfile.getvalue())) as image:
            self.assertEqual(image.format, 'WEBP')
            self.assertLessEqual(max(image.size), 150)
        invalid = request('/api/thumbnail?key=' + quote('2026/../../outside.webp', safe=''))
        invalid.send_error.assert_called_once_with(404, 'Image not found')


if __name__ == '__main__':
    unittest.main()
