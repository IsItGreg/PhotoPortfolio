#!/usr/bin/env python3
"""Bake an assembled website variant without changing the editable master.

Static panels and twelve fixed scores become one two-material rigid mesh.
Moving panels and six scores share one seven-joint, two-material skin. UVs,
triangles, material settings and moving crease weights remain unchanged.
"""
import argparse
import copy
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

from cardboard_folds import flat_rotations
from generate_cardboard_box import GLBBuilder, write_glb
from validate_cardboard_folds import Asset

HERE = Path(__file__).resolve().parent
MASTER = HERE / 'cardboard_mailer_v4_seam_filled_rigged.glb'
OUTPUT = HERE / 'cardboard_mailer_web.glb'


def normalize(normals):
    return normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)


def export(source=MASTER, output=OUTPUT):
    source, output = Path(source), Path(output)
    asset = Asset(source)
    src = asset.doc
    clips = [a for a in src['animations'] if a['name'] in ('Open_Lid', 'Close_Lid')]
    animated = {c['target']['node'] for a in clips for c in a['channels']}
    assert len(animated) == 6
    parents = {c: i for i, n in enumerate(asset.nodes) for c in n.get('children', [])}
    world, flat = asset.world({}), asset.world(flat_rotations(asset.nodes))

    def lineage(index):
        result = [index]
        while result[-1] in parents:
            result.append(parents[result[-1]])
        return result

    def owner(index):
        return next((i for i in lineage(index) if i in animated), None)

    moving_skins = {i for i, n in enumerate(asset.nodes) if 'skin' in n
                    and any(owner(j) is not None for j in src['skins'][n['skin']]['joints'])}
    joint_sources = sorted(animated | {j for i in moving_skins
                                      for j in src['skins'][asset.nodes[i]['skin']]['joints']})
    joint_slots = {old: new for new, old in enumerate(joint_sources)}
    keep = sorted({i for j in joint_sources for i in lineage(j)})
    node_map = {old: new for new, old in enumerate(keep)}
    nodes = []
    for old in keep:
        n = copy.deepcopy(asset.nodes[old])
        for key in ('mesh', 'skin', 'children'):
            n.pop(key, None)
        children = [node_map[c] for c in asset.nodes[old].get('children', []) if c in node_map]
        if children:
            n['children'] = children
        nodes.append(n)
    root = node_map[src['scenes'][0]['nodes'][0]]
    nodes[root]['name'] = 'RIG_CardboardMailer_Web'
    nodes[root].setdefault('extras', {}).update({
        'rigType': 'assembled website rig: six moving hinges, baked tray',
        'foldTreatment': 'twelve fixed scores baked; six moving scores retain original skinning',
    })

    groups = {(kind, mat): [] for kind in ('static', 'moving') for mat in range(2)}
    part_records = []
    for i, node in enumerate(asset.nodes):
        if 'mesh' not in node:
            continue
        rigid_owner = owner(i)
        moving = i in moving_skins or rigid_owner is not None
        kind = 'moving' if moving else 'static'
        for pi, prim in enumerate(asset.primitives(i)):
            attrs = {name: asset.array(index) for name, index in prim['attributes'].items()}
            indices = asset.array(prim['indices']).ravel()
            if not moving:
                pos, normal = asset.transform(i, prim, world)
                attrs = {'POSITION': pos, 'NORMAL': normalize(normal), 'TEXCOORD_0': attrs['TEXCOORD_0']}
            elif 'skin' in node:
                skin = src['skins'][node['skin']]
                ibm = asset.array(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
                assert np.allclose(ibm, [np.linalg.inv(flat[j]) for j in skin['joints']], atol=1e-7)
                slots = np.array([joint_slots[j] for j in skin['joints']], dtype=np.uint16)
                attrs['JOINTS_0'] = slots[attrs['JOINTS_0']]
            else:
                # Put the rigid panel into its controlling joint's flat bind
                # frame; weight 1 preserves the original hierarchical motion.
                transform = flat[rigid_owner] @ np.linalg.inv(world[rigid_owner]) @ world[i]
                attrs['POSITION'] = (np.c_[attrs['POSITION'], np.ones(len(attrs['POSITION']))] @ transform.T)[:, :3]
                attrs['NORMAL'] = normalize(attrs['NORMAL'] @ transform[:3, :3].T)
                count = len(attrs['POSITION'])
                attrs['JOINTS_0'] = np.zeros((count, 4), dtype=np.uint16)
                attrs['JOINTS_0'][:, 0] = joint_slots[rigid_owner]
                attrs['WEIGHTS_0'] = np.tile([1., 0., 0., 0.], (count, 1))
            group = groups[kind, prim['material']]
            part_records.append({
                'sourceNode': i, 'sourcePrimitive': pi, 'kind': kind,
                'material': prim['material'],
                'firstIndex': sum(len(part[1]) for part in group), 'indexCount': len(indices),
            })
            group.append((attrs, indices))

    builder, meshes = GLBBuilder(), []
    group_nodes = {}
    type_by_attr = {'POSITION': 'VEC3', 'NORMAL': 'VEC3', 'TEXCOORD_0': 'VEC2',
                    'JOINTS_0': 'VEC4', 'WEIGHTS_0': 'VEC4'}
    for kind in ('static', 'moving'):
        primitives = []
        for mat in range(2):
            parts = groups[kind, mat]
            names = list(parts[0][0])
            arrays = {name: np.concatenate([p[0][name] for p in parts]).astype(
                np.uint16 if name == 'JOINTS_0' else np.float32) for name in names}
            offsets = np.cumsum([0] + [len(p[0]['POSITION']) for p in parts[:-1]])
            indices = np.concatenate([p[1] + off for p, off in zip(parts, offsets)])
            # Exact-attribute welding retains sharp normals, UV seams, material
            # boundaries and distinct skin weights. No shape simplification.
            packed = np.concatenate([arrays[name].astype(np.float32) for name in names], axis=1)
            _, first, inverse = np.unique(packed, axis=0, return_index=True, return_inverse=True)
            attributes = {name: builder.array(arrays[name][first], 5123 if name == 'JOINTS_0' else 5126,
                                               type_by_attr[name], 34962, name == 'POSITION') for name in names}
            primitives.append({'attributes': attributes,
                               'indices': builder.array(inverse[indices], 5123, 'SCALAR', 34963),
                               'material': mat, 'mode': 4})
        name = 'WEB_Tray' if kind == 'static' else 'WEB_LidAssembly'
        group_nodes[kind] = len(nodes)
        nodes.append({'name': name, 'mesh': len(meshes), **({'skin': 0} if kind == 'moving' else {})})
        nodes[root].setdefault('children', []).append(len(nodes)-1)
        meshes.append({'name': name, 'primitives': primitives})

    skin = {'name': 'WEB_OpeningSkin', 'joints': [node_map[j] for j in joint_sources],
            'skeleton': node_map[asset.names['CTRL_BackWall']],
            'inverseBindMatrices': builder.array([np.linalg.inv(flat[j]).T.reshape(16)
                                                 for j in joint_sources], 5126, 'MAT4')}
    images, textures, texture_report = [], [], []
    webp_used = False
    for image in src['images']:
        view = src['bufferViews'][image['bufferView']]
        raw = asset.binary[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']]
        original = Image.open(io.BytesIO(raw)).convert('RGB')
        compressed = io.BytesIO()
        # The high-effort encoder helps albedo; the faster predictor is already
        # slightly smaller for these normal/ORM maps. Both are pixel-lossless.
        albedo = image['name'] == 'Kraft_Albedo'
        original.save(compressed, format='WEBP', lossless=True,
                      quality=100 if albedo else 75, method=6 if albedo else 4, exact=True)
        webp = compressed.getvalue()
        assert np.array_equal(np.asarray(original), np.asarray(Image.open(io.BytesIO(webp)))), 'Texture pixel change'
        use_webp = len(webp) < len(raw)
        data = webp if use_webp else raw
        index = len(images)
        images.append({'name': image['name'], 'bufferView': builder.blob(data),
                       'mimeType': 'image/webp' if use_webp else image['mimeType']})
        textures.append({'sampler': 0, **({'extensions': {'EXT_texture_webp': {'source': index}}}
                                         if use_webp else {'source': index})})
        webp_used |= use_webp
        texture_report.append({'name': image['name'], 'masterBytes': len(raw), 'webBytes': len(data),
                               'encoding': images[-1]['mimeType'], 'pixelIdentical': True})

    animations, accessors = [], {}
    for clip in clips:
        result = copy.deepcopy(clip)
        for channel in result['channels']:
            channel['target']['node'] = node_map[channel['target']['node']]
        for sampler in result['samplers']:
            for field in ('input', 'output'):
                old = sampler[field]
                if old not in accessors:
                    a = src['accessors'][old]
                    accessors[old] = builder.array(asset.array(old), a['componentType'], a['type'],
                                                  include_bounds=field == 'input')
                sampler[field] = accessors[old]
        animations.append(result)

    doc = {'asset': copy.deepcopy(src['asset']), 'scene': 0,
           'scenes': [{'name': 'Cardboard Mailer — Website', 'nodes': [root]}],
           'nodes': nodes, 'meshes': meshes, 'skins': [skin],
           'materials': copy.deepcopy(src['materials']), 'samplers': copy.deepcopy(src['samplers']),
           'images': images, 'textures': textures, 'animations': animations,
           'bufferViews': builder.buffer_views, 'accessors': builder.accessors, 'buffers': [{'byteLength': 0}],
           'extensionsUsed': list(src.get('extensionsUsed', [])) + (['EXT_texture_webp'] if webp_used else []),
           'extras': {'variant': 'website', 'master': source.name, 'bakedFixedFolds': 12, 'movingFolds': 6}}
    if webp_used:
        doc['extensionsRequired'] = ['EXT_texture_webp']
    write_glb(doc, builder.binary, output)
    report = {'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'output': output.name, 'masterBytes': source.stat().st_size, 'webBytes': output.stat().st_size,
              'renderPieces': 4, 'skinnedRenderPieces': 2, 'joints': len(joint_sources),
              'triangles': sum(asset.array(p['indices']).size//3 for m in src['meshes'] for p in m['primitives']),
              'textures': texture_report, 'groupNodes': group_nodes, 'parts': part_records}
    output.with_suffix('.audit.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('parts', 'groupNodes')}, indent=2), flush=True)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=MASTER)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    export(args.source, args.output)
