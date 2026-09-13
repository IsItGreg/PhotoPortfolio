"""Finite-width score strips, exported as ordinary glTF two-joint skins.

Rigid cores end at the score boundaries. The two paper faces interpolate
between their adjoining panels, compressing through a 90-degree fold. This is
a low-poly visual approximation, not a constant-length or material simulation.
"""
import math
import numpy as np


def flat_rotations(nodes):
    angles = {
        "FrontWall": ("x", 90), "BackWall": ("x", -90),
        "LeftOuterWall": ("z", 90), "RightOuterWall": ("z", -90),
        "LeftTopRail": ("z", 90), "RightTopRail": ("z", -90),
        "LeftInnerWall": ("z", 90), "RightInnerWall": ("z", -90),
        "Lid": ("x", -90), "TuckFlap": ("x", -90),
        "LidWing_L": ("z", -90), "LidWing_R": ("z", 90),
        **{name: ("y", 0) for name in ["FrontExtension_L", "FrontExtension_R",
            "RearExtension_L", "RearExtension_R", "TuckEar_L", "TuckEar_R"]},
    }
    result = {}
    for i, node in enumerate(nodes):
        if node["name"].removeprefix("CTRL_") not in angles:
            continue
        axis, degrees = angles[node["name"].removeprefix("CTRL_")]
        q = [0., 0., 0., math.cos(math.radians(degrees) / 2)]
        q["xyz".index(axis)] = math.sin(math.radians(degrees) / 2)
        result[i] = q
    return result


# Stable dieline IDs, original seam names, panel pair, hinge axis in parent.
FOLDS = [
    ("F01", "LidTuck", "Lid", "TuckFlap", 0),
    ("F02", "LidWing_L", "Lid", "LidWing_L", 2),
    ("F03", "LidWing_R", "Lid", "LidWing_R", 2),
    ("F04", "BackLid", "BackWall", "Lid", 0),
    ("F05", "BottomBack", "Bottom", "BackWall", 0),
    ("F06", "BottomFront", "Bottom", "FrontWall", 0),
    ("F07", "BottomLeft", "Bottom", "LeftOuterWall", 2),
    ("F08", "BottomRight", "Bottom", "RightOuterWall", 2),
    ("F09", "RearExtension_L", "BackWall", "RearExtension_L", 1),
    ("F10", "RearExtension_R", "BackWall", "RearExtension_R", 1),
    ("F11", "FrontExtension_L", "FrontWall", "FrontExtension_L", 1),
    ("F12", "FrontExtension_R", "FrontWall", "FrontExtension_R", 1),
    ("F13", "LeftOuterRail", "LeftOuterWall", "LeftTopRail", 2),
    ("F14", "LeftRailInner", "LeftTopRail", "LeftInnerWall", 2),
    ("F15", "RightOuterRail", "RightOuterWall", "RightTopRail", 2),
    ("F16", "RightRailInner", "RightTopRail", "RightInnerWall", 2),
    ("F17", "TuckEar_L", "TuckFlap", "TuckEar_L", 1),
    ("F18", "TuckEar_R", "TuckFlap", "TuckEar_R", 1),
]


def hull(points):
    points = sorted(set(map(tuple, np.round(points, 12))))
    def turn(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    def half(seq):
        stack = []
        for p in seq:
            while len(stack) >= 2 and turn(stack[-2], stack[-1], p) <= 1e-15:
                stack.pop()
            stack.append(p)
        return stack[:-1]
    return np.asarray(half(points) + half(points[::-1]))


def clip(poly, direction, bound):
    """Convex half-plane clip: dot(point, direction) >= bound."""
    result = []
    for a, b in zip(poly, np.roll(poly, -1, axis=0)):
        da, db = a @ direction - bound, b @ direction - bound
        if da >= -1e-12:
            result.append(a)
        if (da < -1e-12) != (db < -1e-12):
            result.append(a + (b-a) * da / (da-db))
    return np.asarray(result)


def rebuild_fold_geometry(nodes, old_meshes, root, Mesh, matrix, thickness,
                          width, clearance, tile):
    by_name = {n['name']: i for i, n in enumerate(nodes)}
    flat = flat_rotations(nodes)
    world = {}
    def walk(i, parent):
        world[i] = parent @ matrix(nodes[i], flat.get(i))
        for c in nodes[i].get('children', []):
            walk(c, world[i])
    walk(root, np.eye(4))
    panels = {}
    h = width / 2

    for i, node in enumerate(nodes):
        if 'mesh' not in node or node['name'].startswith('SEAM_'):
            continue
        source = old_meshes[node['mesh']]
        points = np.concatenate([p.positions for p in source.primitives.values() if p.positions])
        lo, hi = points.min(0), points.max(0)
        thin = int(np.argmin(hi-lo))
        axes = [a for a in range(3) if a != thin]
        # Clear the floor, rail underside and front/rear walls. The returning
        # wall has a free bottom edge: it is not another hinge to the floor.
        if 'InnerWall' in node['name']:
            lo[1] += thickness / 2 + clearance
        if 'InnerWall' in node['name'] or 'TopRail' in node['name']:
            lo[2] += thickness / 2 + clearance
            hi[2] -= thickness / 2 + clearance
        if 'Extension_' in node['name']:
            lo[1] = h
            hi[1] -= thickness / 2 + clearance
        if 'Wing_' in source.name or 'QuarterCircle' in source.name:
            outline = hull(points[:, axes])
            if 'QuarterCircle' in source.name:
                # Keep the ear below the solid rail cap while it slides out
                # of the open front of the pocket. The circle center stays put.
                relief = node.get('extras', {}).get('upperReliefMeters', 0)
                outline = clip(outline, np.array([0., -1.]), relief)
        else:
            a, b = axes
            outline = np.array([[lo[a], lo[b]], [hi[a], lo[b]],
                                [hi[a], hi[b]], [lo[a], hi[b]]])
        local = np.zeros((len(outline), 3))
        local[:, axes] = outline
        # Every panel uses the same sheet mid-surface, including the floor.
        flat_points = (np.c_[local, np.ones(len(local))] @ world[i].T)[:, :3]
        assert np.max(np.abs(flat_points[:, 1])) < 1e-8
        poly = hull(flat_points[:, [0, 2]])
        panels[i] = {'poly': poly, 'original': poly.copy(), 'folds': []}

    folds = []
    for fid, name, parent_name, child_name, axis in FOLDS:
        parent = by_name['GEO_Bottom' if parent_name == 'Bottom' else 'CTRL_' + parent_name]
        child = by_name['CTRL_' + child_name]
        seam = by_name['SEAM_' + name]
        origin = world[seam][[0, 2], 3]
        along = world[parent][[0, 2], axis]
        along /= np.linalg.norm(along)
        across = np.array([-along[1], along[0]])
        if (panels[child]['original'].mean(0) - origin) @ across < 0:
            across = -across
        f = dict(id=fid, name=name, parent=parent, child=child, seam=seam,
                 origin=origin, along=along, across=across)
        for panel, sign in [(parent, -1), (child, 1)]:
            p = panels[panel]
            p['poly'] = clip(p['poly'], across*sign, origin @ (across*sign) + h)
            assert len(p['poly']) >= 3, (fid, nodes[panel]['name'])
            p['folds'].append((f, sign))
        folds.append(f)

    for f in folds:
        ranges = []
        for panel, sign in [(f['parent'], -1), (f['child'], 1)]:
            poly = panels[panel]['poly']
            on = poly[np.abs((poly-f['origin']) @ f['across'] - sign*h) < 1e-8]
            assert len(on) >= 2, f['id']
            along = (on - f['origin']) @ f['along']
            ranges.append((along.min(), along.max()))
        f['start'], f['end'] = max(r[0] for r in ranges), min(r[1] for r in ranges)
        assert f['end'] > f['start'], f['id']

    result = []
    def xyz(p, y=0):
        return np.array([p[0], y, p[1]])

    for i, panel in panels.items():
        inv = np.linalg.inv(world[i])
        mesh = Mesh(nodes[i]['name'] + '_Board')
        poly = panel['poly']
        # Split boundary edges at the exact fold ends, so the broad faces,
        # crease liners and exposed relief caps share boundary vertices.
        boundary = []
        for a, b in zip(poly, np.roll(poly, -1, axis=0)):
            params = [0.]
            for f, sign in panel['folds']:
                for s in [f['start'], f['end']]:
                    p = f['origin'] + sign*h*f['across'] + s*f['along']
                    t = (p-a) @ (b-a) / ((b-a) @ (b-a))
                    if 1e-8 < t < 1-1e-8 and np.linalg.norm(a+t*(b-a)-p) < 1e-8:
                        params.append(t)
            boundary.extend(a+t*(b-a) for t in sorted(set(params)))
        poly = np.array(boundary)
        def emit(points, normal, material):
            local = [(inv @ np.r_[p, 1])[:3] for p in points]
            mesh.tri(local, inv[:3, :3] @ normal, material)
            prim = mesh.primitives[material]
            # Continuous, fixed world-sheet UVs across every panel and fold.
            for k in range(-3, 0):
                p = (world[i] @ np.r_[prim.positions[k], 1])[:3]
                if material == 0:
                    prim.uvs[k] = [float(p[0]/tile), float(p[2]/tile)]
                else:
                    tangent = np.cross(np.array([0., 1., 0.]), normal)
                    tangent /= np.linalg.norm(tangent)
                    prim.uvs[k] = [float(p @ tangent/tile), float(p[1]/tile)]
        center = poly.mean(0)
        for side in [-1, 1]:
            for a, b in zip(poly, np.roll(poly, -1, axis=0)):
                emit([xyz(center, side*thickness/2), xyz(a, side*thickness/2),
                      xyz(b, side*thickness/2)], np.array([0, side, 0]), 0)
        for a, b in zip(poly, np.roll(poly, -1, axis=0)):
            mid = (a+b)/2
            joined = any(abs((mid-f['origin']) @ f['across']-sign*h) < 1e-8
                         and f['start']-1e-9 <= (mid-f['origin']) @ f['along'] <= f['end']+1e-9
                         for f, sign in panel['folds'])
            if joined:
                continue  # No buried dark cap at a score boundary.
            d = b-a
            normal = xyz([d[1], -d[0]])
            a0, b0 = xyz(a, -thickness/2), xyz(b, -thickness/2)
            a1, b1 = xyz(a, thickness/2), xyz(b, thickness/2)
            emit([a0, b0, b1], normal, 1)
            emit([a0, b1, a1], normal, 1)
        nodes[i]['mesh'] = len(result)
        nodes[i].setdefault('extras', {}).update({
            'flatRotation': flat.get(i, [0, 0, 0, 1]),
            'scoreSetbackMeters': h, 'nominalSheetOutline': panel['original'].tolist()})
        result.append(mesh)

    for f in folds:
        mesh = Mesh('SCORE_' + f['id'])
        mesh.skin_joints = [f['parent'], f['child']]
        mesh.inverse_bind = [np.linalg.inv(world[i]) for i in mesh.skin_joints]
        samples = np.linspace(-h, h, 17)
        def point(s, a, side):
            return xyz(f['origin']+a*f['along']+s*f['across'], side*thickness/2)
        def emit(points, normal, material):
            mesh.tri(points, normal, material)
            prim = mesh.primitives[material]
            for p in prim.positions[-3:]:
                p = np.asarray(p)
                t = np.clip(((p[[0, 2]]-f['origin']) @ f['across']+h)/width, 0, 1)
                w = t*t*(3-2*t)
                prim.joints.append([0, 1, 0, 0])
                prim.weights.append([1-w, w, 0., 0.])
            for k in range(-3, 0):
                p = prim.positions[k]
                if material == 0:
                    prim.uvs[k] = [float(p[0]/tile), float(p[2]/tile)]
                else:
                    prim.uvs[k] = [float(np.array(p)[[0, 2]] @ f['across']/tile), float(p[1]/tile)]
        for s0, s1 in zip(samples[:-1], samples[1:]):
            for side in [-1, 1]:
                a, b = f['start'], f['end']
                p = [point(s0,a,side), point(s1,a,side), point(s1,b,side), point(s0,b,side)]
                emit(p[:3], np.array([0, side, 0]), 0)
                emit([p[0],p[2],p[3]], np.array([0, side, 0]), 0)
            # Only the two ends are real cuts. No circular caps on the hinge.
            for a, sign in [(f['start'], -1), (f['end'], 1)]:
                p = [point(s0,a,-1), point(s1,a,-1), point(s1,a,1), point(s0,a,1)]
                normal = xyz(f['along'] * sign)
                emit(p[:3], normal, 1)
                emit([p[0],p[2],p[3]], normal, 1)
        nd = nodes[f['seam']]
        nd['mesh'] = len(result)
        nd.pop('translation', None)
        nd.pop('rotation', None)
        nd['extras'] = {'foldId': f['id'], 'parentPanel': nodes[f['parent']]['name'],
                        'childPanel': nodes[f['child']]['name'], 'creaseWidthMeters': width,
                        'flatOrigin': xyz(f['origin']).tolist(),
                        'flatAlong': xyz(f['along']).tolist(),
                        'flatAcross': xyz(f['across']).tolist(),
                        'spanMeters': [float(f['start']), float(f['end'])],
                        'bindMatrices': [m.tolist() for m in mesh.inverse_bind]}
        result.append(mesh)
    # Skin geometry is expressed in the flat scene, not a moving panel frame.
    seam_ids = {f['seam'] for f in folds}
    for nd in nodes:
        if 'children' in nd:
            nd['children'] = [c for c in nd['children'] if c not in seam_ids]
    nodes[root]['children'].extend(f['seam'] for f in folds)
    nodes[root]['extras'].update({
        'rigType': 'hierarchical panels with two-joint skinned score strips',
        'foldTreatment': '18 finite-width scores, continuous kraft liners, compressed inner bends; cut caps only on free edges and relief ends',
        'bendModel': 'smoothstep linear skinning, intended for -90 to +90 degrees from flat; not constant-length physics',
        'flatFloorMidSurface': 0.0})
    return result
