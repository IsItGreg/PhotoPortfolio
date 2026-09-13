import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location('scene_baker', Path(__file__).with_name('bake-three-scene.py'))
baker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(baker)


class SceneBakeTests(unittest.TestCase):
    def test_master_has_full_rig_and_production_keeps_opening_controls(self):
        master, _, _ = baker.optimizer.read_glb(baker.MASTER)
        web, _, _ = baker.optimizer.read_glb(baker.PUBLIC / 'models/cardboard-mailer.glb')
        self.assertEqual(len(master['skins']), 18)
        self.assertEqual(len(master['animations']), 5)
        self.assertEqual(len(web['meshes']), 2)
        self.assertEqual(len(web['skins'][0]['joints']), 7)
        self.assertEqual([a['name'] for a in web['animations']], ['Open_Lid', 'Close_Lid'])

    def test_manifest_versions_match_every_generated_asset(self):
        manifest = json.loads((baker.SCENE / 'generated/scene-assets.json').read_text())
        urls = [manifest[k] for k in ['model', 'woodColor', 'woodNormal']]
        urls.extend(label['url'] for label in manifest['labels'])
        for url in urls:
            name, digest = url.split('?v=')
            self.assertEqual(baker.sha(baker.PUBLIC / name.lstrip('/'))[:16], digest)

    def test_label_bake_is_deterministic_transparent_and_not_clipped(self):
        config = json.loads((baker.SCENE / 'sceneConfig.json').read_text())
        with tempfile.TemporaryDirectory() as temporary:
            for label in config['labels']:
                first, second = Path(temporary) / 'first.webp', Path(temporary) / 'second.webp'
                a = baker.bake_label(label, baker.SOURCE / 'LOSTLATE.ttf', first)
                b = baker.bake_label(label, baker.SOURCE / 'LOSTLATE.ttf', second)
                self.assertEqual(a, b)
                self.assertEqual(first.read_bytes(), second.read_bytes())
                with Image.open(first) as image:
                    self.assertEqual(image.mode, 'RGBA')
                    bounds = image.getchannel('A').getbbox()
                    self.assertIsNotNone(bounds)
                    self.assertGreater(bounds[0], 0)
                    self.assertGreater(bounds[1], 0)
                    self.assertLess(bounds[2], image.width)
                    self.assertLess(bounds[3], image.height)

    def test_font_metrics_use_the_original_font(self):
        em, asc, desc, gap = baker.font_metrics(baker.SOURCE / 'LOSTLATE.ttf')
        self.assertGreater(em, 0)
        self.assertGreater(asc, desc)
        self.assertGreaterEqual(gap, 0)

    def test_identical_generated_file_does_not_trigger_hmr(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'manifest.json'
            baker.write_changed(output, b'{"version": 1}')
            before = output.stat().st_mtime_ns
            baker.write_changed(output, b'{"version": 1}')
            self.assertEqual(output.stat().st_mtime_ns, before)
            baker.write_changed(output, b'{"version": 2}')
            self.assertEqual(output.read_bytes(), b'{"version": 2}')


if __name__ == '__main__':
    unittest.main()
