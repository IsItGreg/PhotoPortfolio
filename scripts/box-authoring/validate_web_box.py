#!/usr/bin/env python3
"""Check baked geometry against every original triangle through both clips."""
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

from export_web_box import MASTER, OUTPUT, normalize
from validate_cardboard_folds import Asset


def check(source=MASTER, output=OUTPUT, samples=101):
    source, output = Path(source), Path(output)
    original, web = Asset(source), Asset(output)
    report = json.loads(output.with_suffix('.audit.json').read_text())
    assert hashlib.sha256(source.read_bytes()).hexdigest() == report['sourceSha256']
    assert len(web.doc['meshes']) == 2
    assert sum(len(m['primitives']) for m in web.doc['meshes']) == 4
    assert len(web.doc['skins']) == 1 and len(web.doc['skins'][0]['joints']) == 7
    assert web.doc['materials'] == original.doc['materials']
    assert web.doc['samplers'] == original.doc['samplers']
    assert {a['name'] for a in web.doc['animations']} == {'Open_Lid', 'Close_Lid'}
    assert len(original.doc['animations']) == 5 and len(original.doc['skins']) == 18

    lookups = []
    for part in report['parts']:
        index, pi = part['sourceNode'], part['sourcePrimitive']
        node = report['groupNodes'][part['kind']]
        primitive = original.primitives(index)[pi]
        target = next(p for p in web.primitives(node) if p['material'] == part['material'])
        source_indices = original.array(primitive['indices']).ravel()
        first, count = part['firstIndex'], part['indexCount']
        target_indices = web.array(target['indices']).ravel()[first:first+count]
        assert len(source_indices) == len(target_indices) == count
        assert np.array_equal(original.array(primitive['attributes']['TEXCOORD_0'])[source_indices],
                              web.array(target['attributes']['TEXCOORD_0'])[target_indices]), 'UV change'
        lookups.append((index, primitive, source_indices, node, target, target_indices))
    assert sum(len(item[2]) for item in lookups)//3 == report['triangles']
    static_node = report['groupNodes']['static']
    assert 'skin' not in web.nodes[static_node]
    assert all('JOINTS_0' not in p['attributes'] for p in web.primitives(static_node))

    worst_position, worst_normal = 0., 0.
    for clip in ('Open_Lid', 'Close_Lid'):
        for fraction in np.linspace(0, 1, samples):
            old_world = original.world(original.animation_pose(clip, fraction))
            new_world = web.world(web.animation_pose(clip, fraction))
            target_cache = {}
            for index, prim, old_ids, node, target, new_ids in lookups:
                key = node, target['material']
                if key not in target_cache:
                    target_cache[key] = web.transform(node, target, new_world)
                old_p, old_n = original.transform(index, prim, old_world)
                new_p, new_n = target_cache[key]
                error = np.max(np.linalg.norm(old_p[old_ids]-new_p[new_ids], axis=1))
                normal_error = np.max(np.linalg.norm(normalize(old_n[old_ids])-normalize(new_n[new_ids]), axis=1))
                worst_position = max(worst_position, error)
                worst_normal = max(worst_normal, normal_error)
                assert error < 2e-7, (clip, fraction, original.nodes[index]['name'], error)
                assert normal_error < 2e-5, (clip, fraction, original.nodes[index]['name'], normal_error)
    for old_image, new_image in zip(original.doc['images'], web.doc['images']):
        pixels = []
        for asset, image in ((original, old_image), (web, new_image)):
            view = asset.doc['bufferViews'][image['bufferView']]
            start = view.get('byteOffset', 0)
            pixels.append(np.asarray(Image.open(io.BytesIO(asset.binary[start:start+view['byteLength']])).convert('RGB')))
        assert pixels[0].shape == pixels[1].shape
        assert np.array_equal(*pixels), old_image['name']
    assert 'EXT_texture_webp' in web.doc['extensionsRequired']
    for texture in web.doc['textures']:
        assert 'EXT_texture_webp' in texture['extensions']
    assert output.stat().st_size < source.stat().st_size * .7
    print(f'PASS: all {report["triangles"]:,} triangles match master over {samples*2} poses; max position error {worst_position:.2e} m, normal error {worst_normal:.2e}.')
    print('PASS: identical UVs, all three decoded texture maps, materials and samplers; 4 render pieces, 2 skinned, 7 joints; master keeps full rig.')
    return report


if __name__ == '__main__':
    check()
