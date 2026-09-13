"""Validate the exported skinning, not just the generator's in-memory model."""
import json
import struct
from pathlib import Path
import numpy as np

from cardboard_folds import flat_rotations
from generate_cardboard_box import INCH, THICKNESS, matrix_from_trs, quat


class Asset:
    def __init__(self, path):
        raw = Path(path).read_bytes()
        n = struct.unpack_from('<I', raw, 12)[0]
        self.doc = json.loads(raw[20:20+n])
        self.binary = raw[28+n:]
        self.nodes = self.doc['nodes']
        self.names = {n['name']: i for i, n in enumerate(self.nodes)}

    def array(self, index):
        a = self.doc['accessors'][index]
        v = self.doc['bufferViews'][a['bufferView']]
        dtype = {5126: '<f4', 5123: '<u2', 5125: '<u4'}[a['componentType']]
        size = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        stride = np.dtype(dtype).itemsize
        return np.ndarray((a['count'], size), dtype=dtype, buffer=self.binary,
                          offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                          strides=(v.get('byteStride', size*stride), stride)).copy()

    def primitives(self, index):
        return self.doc['meshes'][self.nodes[index]['mesh']]['primitives']

    def world(self, rotations):
        result = {}
        def visit(i, parent):
            result[i] = parent @ matrix_from_trs(self.nodes[i], rotations.get(i))
            for child in self.nodes[i].get('children', []):
                visit(child, result[i])
        for root in self.doc['scenes'][0]['nodes']:
            visit(root, np.eye(4))
        return result

    def animation_pose(self, name, fraction):
        clip = next(a for a in self.doc['animations'] if a['name'] == name)
        pose = {}
        for channel in clip['channels']:
            assert channel['target']['path'] == 'rotation'
            sampler = clip['samplers'][channel['sampler']]
            times = self.array(sampler['input']).ravel()
            values = self.array(sampler['output'])
            time = np.clip(fraction, 0, 1) * times[-1]
            k = min(len(times)-2, max(0, int(np.searchsorted(times, time)-1)))
            t = (time-times[k]) / (times[k+1]-times[k])
            a, b = values[k].astype(float), values[k+1].astype(float)
            dot = float(a @ b)
            if dot < 0:
                b, dot = -b, -dot
            if dot > .9995:
                q = a*(1-t)+b*t
                q /= np.linalg.norm(q)
            else:
                angle = np.arccos(np.clip(dot, -1, 1))
                q = (np.sin((1-t)*angle)*a + np.sin(t*angle)*b) / np.sin(angle)
            pose[channel['target']['node']] = q.tolist()
        return pose

    def transform(self, index, primitive, world):
        p = self.array(primitive['attributes']['POSITION'])
        n = self.array(primitive['attributes']['NORMAL'])
        if 'skin' not in self.nodes[index]:
            return (np.c_[p, np.ones(len(p))] @ world[index].T)[:, :3], n @ world[index][:3, :3].T
        skin = self.doc['skins'][self.nodes[index]['skin']]
        ibm = self.array(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
        transforms = np.array([world[j] @ inv for j, inv in zip(skin['joints'], ibm)])
        joints = self.array(primitive['attributes']['JOINTS_0'])
        weights = self.array(primitive['attributes']['WEIGHTS_0'])
        assert np.all(joints < len(transforms))
        assert np.all(weights >= 0) and np.allclose(weights.sum(1), 1, atol=1e-7)
        blended = (transforms[joints] * weights[:, :, None, None]).sum(1)
        return (blended @ np.c_[p, np.ones(len(p))][:, :, None])[:, :3, 0], (blended[:, :3, :3] @ n[:, :, None])[:, :, 0]


def check(path=None):
    asset = Asset(path or Path(__file__).with_name('cardboard_mailer_v4_seam_filled_rigged.glb'))
    nodes = asset.nodes
    seams = [i for i, n in enumerate(nodes) if n['name'].startswith('SEAM_')]
    assert len(seams) == len(asset.doc['skins']) == 18
    flat = flat_rotations(nodes)
    closed = {asset.names[name]: quat(axis, deg*np.pi/180) for name, axis, deg in [
        ('CTRL_Lid','x',0), ('CTRL_TuckFlap','x',0),
        ('CTRL_LidWing_L','z',0), ('CTRL_LidWing_R','z',0),
        ('CTRL_TuckEar_L','y',-90), ('CTRL_TuckEar_R','y',90)]}
    bind = asset.world(flat)
    # Every broad surface is in the same flat sheet, including the floor.
    for i, n in enumerate(nodes):
        if 'mesh' not in n:
            continue
        for prim in asset.primitives(i):
            p, _ = asset.transform(i, prim, bind)
            assert np.allclose(np.abs(p[:, 1]), THICKNESS/2, atol=8e-8), n['name']

    worst_gap = 0.
    poses = []
    for end_pose in [closed, {}]:
        for t in np.linspace(0, 1, 25):
            pose = {}
            for i, start in flat.items():
                end = np.array(end_pose.get(i, nodes[i].get('rotation', [0, 0, 0, 1])))
                start = np.array(start)
                if end @ start < 0:
                    end = -end
                q = start*(1-t)+end*t
                pose[i] = (q/np.linalg.norm(q)).tolist()
            poses.append(pose)
    # Also check the actual portfolio/GIF opening curve in both directions.
    from generate_open_close_gif import rig_pose
    poses.extend(rig_pose(asset.names, t) for t in np.linspace(0, 1, 41))
    for pose in poses:
        world = asset.world(pose)
        for i in seams:
            node = nodes[i]
            meta = node['extras']
            for prim in asset.primitives(i):
                pos = asset.array(prim['attributes']['POSITION'])
                weights = asset.array(prim['attributes']['WEIGHTS_0'])
                p, n = asset.transform(i, prim, world)
                assert np.isfinite(p).all() and np.isfinite(n).all()
                if prim['material'] == 1:
                    along = (pos-np.array(meta['flatOrigin'])) @ np.array(meta['flatAlong'])
                    assert np.min(np.abs(along[:, None]-meta['spanMeters']), axis=1).max() < 5e-8
                    continue
                idx = asset.array(prim['indices']).reshape(-1, 3)
                cross = np.cross(p[idx[:, 1]]-p[idx[:, 0]], p[idx[:, 2]]-p[idx[:, 0]])
                area = np.linalg.norm(cross, axis=1)
                assert area.min() > 1e-12, (node['name'], 'collapsed face')
                alignment = (cross * n[idx].mean(1)).sum(1)
                assert alignment.min() > 0, (node['name'], 'inverted liner')
                for k, key in enumerate(['parentPanel', 'childPanel']):
                    anchors = p[weights[:, k] > 1-1e-7]
                    panel = asset.names[meta[key]]
                    broad = next(pr for pr in asset.primitives(panel) if pr['material'] == 0)
                    board, _ = asset.transform(panel, broad, world)
                    gap = np.linalg.norm(anchors[:, None, :]-board[None, :, :], axis=2).min(1).max()
                    worst_gap = max(worst_gap, gap)
                    assert gap < 1e-7, (node['name'], 'detached', gap)
    print(f'PASS: 18 folds, {len(poses)} poses; flat coplanarity, normalized skin weights, '
          f'no detached endpoints or inverted liner triangles. Max endpoint error {worst_gap/INCH:.8f} in.')
    print('PASS: dark crease caps occur only at real cut/relief ends.')
    print('Scope: fold continuity and local deformation, NOT whole-box collision or manufacturing validation.')
    return asset


if __name__ == '__main__':
    check()
