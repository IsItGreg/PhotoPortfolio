import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageCms

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'localimages/scripts'))
from photo_assets import prepare_photo, jpeg_sources, asset_current, strip_jpeg_metadata


class PhotoAssetTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.key = '2026/infrared/a photo'
        self.jpeg = self.root / f'localimages/jpg/{self.key}.jpg'
        self.webp = self.root / f'localimages/webp/{self.key}.webp'
        self.jpeg.parent.mkdir(parents=True)
        self.webp.parent.mkdir(parents=True)
        # The library WebP intentionally depicts an OLD edit.
        Image.new('RGB', (720, 480), 'red').save(self.jpeg, quality=95)
        Image.new('RGB', (720, 480), 'blue').save(self.webp)

    def test_current_jpeg_is_reencoded_not_copied_or_replaced_by_stale_library_webp(self):
        asset = prepare_photo(self.root, self.key)
        from urllib.parse import unquote
        for variant in asset['variants']:
            path = self.root / 'public' / unquote(variant['url']).lstrip('/')
            with Image.open(path) as image:
                self.assertEqual(image.format, 'WEBP')
                self.assertFalse(image.getexif())
                red, green, blue = image.convert('RGB').getpixel((0, 0))
                self.assertGreater(red, blue + 100)
                self.assertEqual(image.size, (variant['width'], variant['height']))
                self.assertLessEqual(image.width, 720)
            self.assertNotEqual(path.read_bytes(), self.jpeg.read_bytes())
        jpegs = jpeg_sources(self.root)
        self.assertTrue(asset_current(self.root, self.key, asset, jpegs))
        Image.new('RGB', (720, 480), 'green').save(self.jpeg, quality=95)
        self.assertFalse(asset_current(self.root, self.key, asset, jpegs))
        updated = prepare_photo(self.root, self.key)
        self.assertNotEqual(updated['full']['url'], asset['full']['url'])

    def test_originals_untouched_and_nested_urls_encoded(self):
        originals = [self.jpeg.read_bytes(), self.webp.read_bytes()]
        result = prepare_photo(self.root, self.key)
        self.assertEqual(originals, [self.jpeg.read_bytes(), self.webp.read_bytes()])
        self.assertTrue(all('infrared/a%20photo_' in v['url'] for v in result['variants']))
        self.assertTrue(result['placeholder'].startswith('data:image/webp;base64,'))
        self.assertEqual(result['full']['width'], 720)

    def test_jpeg_metadata_removal_preserves_decoded_pixels_and_color_profile(self):
        image = Image.new('RGB', (80, 60), 'orange')
        exif = Image.Exif()
        exif[305] = 'Private editor metadata'
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        buffer = io.BytesIO()
        image.save(buffer, 'JPEG', exif=exif, icc_profile=profile, progressive=True)
        cleaned = strip_jpeg_metadata(buffer.getvalue())
        with Image.open(io.BytesIO(buffer.getvalue())) as before, Image.open(io.BytesIO(cleaned)) as after:
            self.assertEqual(before.tobytes(), after.tobytes())
            self.assertEqual(after.info['icc_profile'], profile)
            self.assertFalse(after.getexif())
        self.assertLess(len(cleaned), len(buffer.getvalue()))

    def test_orientation_applied_once_and_no_upscaling(self):
        image = Image.new('RGB', (40, 60), 'orange')
        exif = Image.Exif()
        exif[274] = 6
        image.save(self.jpeg, exif=exif)
        asset = prepare_photo(self.root, self.key)
        self.assertEqual((asset['width'], asset['height']), (60, 40))
        self.assertEqual(len(asset['variants']), 1)


if __name__ == '__main__':
    unittest.main()
