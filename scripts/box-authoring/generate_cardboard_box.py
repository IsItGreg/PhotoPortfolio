#!/usr/bin/env python3
"""Build a textured, articulated 7 x 7 x 2 inch cardboard mailer as GLB."""

from __future__ import annotations

import io
import json
import math
import struct
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


OUT = Path(__file__).resolve().parent
TEXTURES = OUT / "textures"
INCH = 0.0254
WIDTH = 7.0 * INCH
DEPTH = 7.0 * INCH
HEIGHT = 2.0 * INCH
THICKNESS = 0.06 * INCH
BEVEL = 0.012 * INCH
FIT_CLEARANCE = 0.005 * INCH
# Pocket order: outer wall / rounded ear / structural extension / return.
# The large lid wings descend INSIDE the return walls, not through the rail.
EAR_INSET = THICKNESS + FIT_CLEARANCE
TUCK_WIDTH = WIDTH - 2 * EAR_INSET
WALL_INSET = EAR_INSET + THICKNESS + FIT_CLEARANCE
END_WALL_WIDTH = WIDTH - 2 * WALL_INSET
RAIL_WIDTH = 0.20 * INCH
LID_INSET = RAIL_WIDTH + THICKNESS + FIT_CLEARANCE
LID_WIDTH = WIDTH - 2.0 * LID_INSET
LID_DEPTH = DEPTH + THICKNESS + FIT_CLEARANCE
BACK_HEIGHT = HEIGHT + THICKNESS + FIT_CLEARANCE
WING_END_CLEARANCE = THICKNESS / 2 + FIT_CLEARANCE
EAR_TOP_RELIEF = BACK_HEIGHT - HEIGHT + THICKNESS / 2 + FIT_CLEARANCE
WING_HEIGHT = 1.92 * INCH
WING_OPEN_DEGREES = 25.0
EAR_RELEASE_DEGREES = 45.0
EAR_OPEN_DEGREES = 25.0
EXTENSION_LENGTH = 3.47 * INCH
CREASE_WIDTH = 0.10 * INCH
KRAFT_TILE_SIZE = 2.9 * INCH


def quat(axis: str, angle: float) -> list[float]:
    s, c = math.sin(angle / 2.0), math.cos(angle / 2.0)
    return {
        "x": [s, 0.0, 0.0, c],
        "y": [0.0, s, 0.0, c],
        "z": [0.0, 0.0, s, c],
    }[axis]


def align4(data: bytearray) -> None:
    while len(data) % 4:
        data.append(0)


@dataclass
class Primitive:
    positions: list[list[float]] = field(default_factory=list)
    normals: list[list[float]] = field(default_factory=list)
    uvs: list[list[float]] = field(default_factory=list)
    indices: list[int] = field(default_factory=list)
    joints: list[list[int]] = field(default_factory=list)
    weights: list[list[float]] = field(default_factory=list)


@dataclass
class MeshData:
    name: str
    primitives: dict[int, Primitive] = field(
        default_factory=lambda: {0: Primitive(), 1: Primitive()}
    )
    skin_joints: list[int] = field(default_factory=list)
    inverse_bind: list = field(default_factory=list)

    @staticmethod
    def uv_for(point: np.ndarray, normal: np.ndarray, scale: float = KRAFT_TILE_SIZE) -> list[float]:
        axis = int(np.argmax(np.abs(normal)))
        if axis == 0:
            # Keep the sheet grain basis consistent on panels whose broad face
            # is perpendicular to X (side walls and lid wings). The previous
            # Z/Y ordering rotated the directional texture relative to every
            # other cardboard panel.
            u, v = point[1], point[2]
        elif axis == 1:
            u, v = point[0], point[2]
        else:
            u, v = point[0], point[1]
        return [float(u / scale), float(v / scale)]

    def tri(self, points, outward, material: int) -> None:
        pts = [np.asarray(p, dtype=np.float64) for p in points]
        desired = np.asarray(outward, dtype=np.float64)
        actual = np.cross(pts[1] - pts[0], pts[2] - pts[0])
        if float(np.dot(actual, desired)) < 0:
            pts[1], pts[2] = pts[2], pts[1]
        n = desired / max(np.linalg.norm(desired), 1e-12)
        prim = self.primitives[material]
        base = len(prim.positions)
        for p in pts:
            prim.positions.append(p.astype(float).tolist())
            prim.normals.append(n.astype(float).tolist())
            prim.uvs.append(self.uv_for(p, n))
        prim.indices.extend([base, base + 1, base + 2])

    def quad(self, points, outward, material: int) -> None:
        self.tri([points[0], points[1], points[2]], outward, material)
        self.tri([points[0], points[2], points[3]], outward, material)


def chamfered_box(name: str, dims, center, thin_axis: int, edge_material: int = 1) -> MeshData:
    """A faceted, one-segment bevel keeps the silhouette low-poly but catches light."""
    mesh = MeshData(name)
    h = np.asarray(dims, dtype=np.float64) / 2.0
    c = np.asarray(center, dtype=np.float64)
    b = min(BEVEL, float(np.min(h)) * 0.42)

    # Six broad face centers.
    for axis in range(3):
        other = [i for i in range(3) if i != axis]
        for sign in (-1, 1):
            normal = np.zeros(3)
            normal[axis] = sign
            pts = []
            for a, d in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
                p = np.zeros(3)
                p[axis] = sign * h[axis]
                p[other[0]] = a * (h[other[0]] - b)
                p[other[1]] = d * (h[other[1]] - b)
                pts.append(p + c)
            mesh.quad(pts, normal, 0 if axis == thin_axis else edge_material)

    # Twelve bevel strips.
    for variable in range(3):
        fixed = [i for i in range(3) if i != variable]
        a, d = fixed
        for sa in (-1, 1):
            for sd in (-1, 1):
                normal = np.zeros(3)
                normal[a], normal[d] = sa, sd
                pts = []
                for sv, face in [(-1, a), (1, a), (1, d), (-1, d)]:
                    p = np.zeros(3)
                    p[variable] = sv * (h[variable] - b)
                    if face == a:
                        p[a], p[d] = sa * h[a], sd * (h[d] - b)
                    else:
                        p[a], p[d] = sa * (h[a] - b), sd * h[d]
                    pts.append(p + c)
                mesh.quad(pts, normal, edge_material)

    # Eight low-poly corner caps.
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                signs = np.array([sx, sy, sz], dtype=float)
                pts = []
                for axis in range(3):
                    p = signs * (h - b)
                    p[axis] = signs[axis] * h[axis]
                    pts.append(p + c)
                mesh.tri(pts, signs, edge_material)
    return mesh


def polygon_prism(name: str, polygon, thin_axis: int, thickness: float, edge_material: int = 1) -> MeshData:
    """Extrude a convex 2D polygon along thin_axis; used for tapered lid wings."""
    mesh = MeshData(name)
    axes = [i for i in range(3) if i != thin_axis]
    half = thickness / 2.0

    def p3(pair, side):
        p = np.zeros(3)
        p[thin_axis] = side * half
        p[axes[0]], p[axes[1]] = pair
        return p

    # broad faces
    for side in (-1, 1):
        normal = np.zeros(3)
        normal[thin_axis] = side
        root = p3(polygon[0], side)
        for i in range(1, len(polygon) - 1):
            mesh.tri([root, p3(polygon[i], side), p3(polygon[i + 1], side)], normal, 0)
    # thickness edge
    for i, a in enumerate(polygon):
        b = polygon[(i + 1) % len(polygon)]
        pa, pb = p3(a, -1), p3(b, -1)
        qa, qb = p3(a, 1), p3(b, 1)
        edge = np.asarray(b) - np.asarray(a)
        outward2 = np.array([edge[1], -edge[0]], dtype=float)
        normal = np.zeros(3)
        normal[axes[0]], normal[axes[1]] = outward2
        mesh.quad([pa, pb, qb, qa], normal, edge_material)
    return mesh


def make_textures(size=1024):
    TEXTURES.mkdir(exist_ok=True)
    rng = np.random.default_rng(84273)

    def periodic_noise(blur_pixels: float) -> np.ndarray:
        """Seamless Gaussian-filtered noise without visible tile borders."""
        noise = rng.normal(0, 1, (size, size)).astype(np.float32)
        spectrum = np.fft.rfft2(noise)
        fy = np.fft.fftfreq(size)[:, None]
        fx = np.fft.rfftfreq(size)[None, :]
        gaussian = np.exp(
            -2.0 * math.pi * math.pi * blur_pixels * blur_pixels * (fx * fx + fy * fy)
        )
        field = np.fft.irfft2(spectrum * gaussian, s=(size, size)).astype(np.float32)
        field -= float(field.mean())
        field /= max(float(field.std()), 1e-6)
        return field

    # Isotropic pulp at several physical scales avoids the cross-hatched
    # banding that made differently oriented panels appear stretched.
    fine = periodic_noise(0.65)
    medium = periodic_noise(4.5)
    coarse = periodic_noise(30.0)

    # Sparse short fibers add recognizable paper detail without imposing one
    # dominant direction. Copies across neighboring tiles keep the map seamless.
    fiber_layer = Image.new("L", (size, size), 0)
    fiber_draw = ImageDraw.Draw(fiber_layer)
    for _ in range(size * 5):
        cx, cy = rng.uniform(0, size, 2)
        angle = rng.uniform(0, math.pi)
        length = rng.uniform(4, 24)
        dx = math.cos(angle) * length * 0.5
        dy = math.sin(angle) * length * 0.5
        shade = int(rng.integers(32, 118))
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                fiber_draw.line(
                    (cx - dx + ox, cy - dy + oy, cx + dx + ox, cy + dy + oy),
                    fill=shade,
                    width=1,
                )
    fiber_layer = fiber_layer.filter(ImageFilter.GaussianBlur(0.35))
    fibers = np.asarray(fiber_layer, dtype=np.float32) / 255.0

    pulp = 0.005 * fine + 0.010 * medium + 0.014 * coarse - 0.012 * fibers
    specks = rng.random((size, size))
    pulp -= (specks > 0.9990) * rng.uniform(0.035, 0.12, (size, size))

    kraft = np.array([0.55, 0.315, 0.125], dtype=np.float32)
    rgb = np.clip(kraft[None, None, :] + (pulp * 0.52)[:, :, None], 0, 1)
    albedo = Image.fromarray(np.uint8(np.power(rgb, 1 / 2.2) * 255), "RGB")
    albedo.save(TEXTURES / "kraft_albedo.png", optimize=True)

    # Preserve the true (small) relief amplitude. Normalizing the whole field
    # made broad tonal mottling behave like deep hills in the normal map.
    height = pulp
    # Periodic differences preserve the repeating texture's normal direction
    # at tile boundaries, unlike one-sided derivatives at the image edges.
    gx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    gy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    strength = 7.5
    normal = np.dstack((-gx * strength, -gy * strength, np.ones_like(gx)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    normal_img = Image.fromarray(np.uint8(np.clip(normal * 0.5 + 0.5, 0, 1) * 255), "RGB")
    normal_img.save(TEXTURES / "kraft_normal.png", optimize=True)

    rough = np.clip(0.86 + coarse * 0.035 + fine * 0.025, 0.72, 0.98)
    ao = np.clip(0.98 - np.maximum(-pulp, 0) * 0.3, 0.82, 1.0)
    orm = np.dstack((ao, rough, np.zeros_like(rough)))
    orm_img = Image.fromarray(np.uint8(orm * 255), "RGB")
    orm_img.save(TEXTURES / "kraft_orm.png", optimize=True)
    return [albedo, normal_img, orm_img]


class GLBBuilder:
    def __init__(self):
        self.binary = bytearray()
        self.buffer_views = []
        self.accessors = []

    def blob(self, raw: bytes, target=None) -> int:
        align4(self.binary)
        offset = len(self.binary)
        self.binary.extend(raw)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw)}
        if target:
            view["target"] = target
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def array(self, values, component_type, kind, target=None, include_bounds=False) -> int:
        dtype = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}[component_type]
        a = np.asarray(values, dtype=dtype)
        view = self.blob(a.tobytes(), target)
        count = int(a.shape[0])
        acc = {"bufferView": view, "componentType": component_type, "count": count, "type": kind}
        if include_bounds:
            acc["min"] = np.min(a, axis=0).astype(float).tolist()
            acc["max"] = np.max(a, axis=0).astype(float).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1


def build_scene(textures):
    meshes = []
    mesh_data = []
    mesh_lookup = {}

    def add_mesh(mesh):
        mesh_lookup[mesh.name] = len(meshes)
        mesh_data.append(mesh)
        meshes.append(None)

    # Primary panels.
    add_mesh(chamfered_box("Bottom_Board", [WIDTH, THICKNESS, DEPTH], [0, -THICKNESS / 2, 0], 1))
    add_mesh(chamfered_box("Front_Wall", [END_WALL_WIDTH, HEIGHT, THICKNESS], [0, HEIGHT / 2, 0], 2))
    add_mesh(chamfered_box("Back_Wall", [END_WALL_WIDTH, BACK_HEIGHT, THICKNESS], [0, BACK_HEIGHT / 2, 0], 2))
    add_mesh(chamfered_box("Side_Outer_Wall", [THICKNESS, HEIGHT, DEPTH], [0, HEIGHT / 2, 0], 0))
    add_mesh(chamfered_box("Side_Inner_Wall", [THICKNESS, HEIGHT, DEPTH], [0, -HEIGHT / 2, 0], 0))
    add_mesh(chamfered_box("Top_Rail_L", [RAIL_WIDTH, THICKNESS, DEPTH], [RAIL_WIDTH / 2, 0, 0], 1))
    add_mesh(chamfered_box("Top_Rail_R", [RAIL_WIDTH, THICKNESS, DEPTH], [-RAIL_WIDTH / 2, 0, 0], 1))
    add_mesh(chamfered_box("Lid_Main_Narrow", [LID_WIDTH, THICKNESS, LID_DEPTH], [0, 0, LID_DEPTH / 2], 1))
    add_mesh(chamfered_box("Tuck_Flap_Rectangle", [TUCK_WIDTH, HEIGHT, THICKNESS], [0, -HEIGHT / 2, 0], 2))

    # Rounded trapezoids: full 7-inch hinge, shorter parallel outer edge.
    wing_poly = [
        (0.0, WING_END_CLEARANCE),
        (-WING_HEIGHT * 0.72, WING_END_CLEARANCE + 0.08 * INCH),
        (-WING_HEIGHT, WING_END_CLEARANCE + 0.32 * INCH),
        (-WING_HEIGHT, DEPTH - WING_END_CLEARANCE - 0.32 * INCH),
        (-WING_HEIGHT * 0.72, DEPTH - WING_END_CLEARANCE - 0.18 * INCH),
        (0.0, DEPTH - WING_END_CLEARANCE),
    ]
    add_mesh(polygon_prism("Lid_Wing_L", wing_poly, 0, THICKNESS))
    add_mesh(polygon_prism("Lid_Wing_R", wing_poly, 0, THICKNESS))

    # Separate R=2-inch quarter-circle sectors, hinged to the tuck-flap sides.
    left_ear_poly = [(0.0, 0.0)] + [
        (HEIGHT * math.cos(a), HEIGHT * math.sin(a))
        for a in np.linspace(math.pi, math.pi * 1.5, 8)
    ]
    right_ear_poly = [(0.0, 0.0)] + [
        (HEIGHT * math.cos(a), HEIGHT * math.sin(a))
        for a in np.linspace(-math.pi / 2, 0.0, 8)
    ]
    add_mesh(polygon_prism("Tuck_Ear_L_QuarterCircle", left_ear_poly, 2, THICKNESS))
    add_mesh(polygon_prism("Tuck_Ear_R_QuarterCircle", right_ear_poly, 2, THICKNESS))

    # Front/rear wall extensions reach to the midpoint and sit inside the rolled walls.
    # These are genuinely separate panels in the dieline: the four horizontal
    # corner slits free them from the side-wall strip.  Once folded, they sit
    # safely between the outer and return walls, never on the visible exterior.
    # Tabs share their parent wall's plane in the sheet. Their inset comes
    # from the shortened wall and relocated hinge, never a mesh-only offset.
    add_mesh(chamfered_box("Front_Extension_L", [EXTENSION_LENGTH, HEIGHT, THICKNESS], [-EXTENSION_LENGTH / 2, HEIGHT / 2, 0], 2))
    add_mesh(chamfered_box("Front_Extension_R", [EXTENSION_LENGTH, HEIGHT, THICKNESS], [EXTENSION_LENGTH / 2, HEIGHT / 2, 0], 2))
    add_mesh(chamfered_box("Rear_Extension_L", [EXTENSION_LENGTH, HEIGHT, THICKNESS], [-EXTENSION_LENGTH / 2, HEIGHT / 2, 0], 2))
    add_mesh(chamfered_box("Rear_Extension_R", [EXTENSION_LENGTH, HEIGHT, THICKNESS], [EXTENSION_LENGTH / 2, HEIGHT / 2, 0], 2))

    # Temporary hinge markers describe the nominal dieline. The score builder
    # replaces them with individually skinned strips after the rig is assembled.
    for name in ["SEAM_Fillet_X_Tray", "SEAM_Fillet_X_Lid",
                 "SEAM_Fillet_Y_Wall", "SEAM_Fillet_Z_Depth"]:
        add_mesh(MeshData(name))

    # Node helper. Transform-only nodes are the rigid cardboard hinge controls.
    nodes = []
    def node(name, mesh=None, translation=None, rotation=None, children=None, extras=None):
        d = {"name": name}
        if mesh is not None: d["mesh"] = mesh_lookup[mesh]
        if translation is not None: d["translation"] = translation
        if rotation is not None: d["rotation"] = rotation
        if children: d["children"] = children
        if extras: d["extras"] = extras
        nodes.append(d)
        return len(nodes) - 1

    bottom = node("GEO_Bottom", "Bottom_Board")

    front_ext_seam_l = node("SEAM_FrontExtension_L", "SEAM_Fillet_Y_Wall", [-END_WALL_WIDTH / 2, HEIGHT / 2, 0])
    front_ext_seam_r = node("SEAM_FrontExtension_R", "SEAM_Fillet_Y_Wall", [END_WALL_WIDTH / 2, HEIGHT / 2, 0])
    front_ext_l = node("CTRL_FrontExtension_L", "Front_Extension_L", [-END_WALL_WIDTH / 2, 0, 0], quat("y", -math.pi / 2), extras={"hingeAxis": "-Y", "capturedBy": "left rolled wall"})
    front_ext_r = node("CTRL_FrontExtension_R", "Front_Extension_R", [END_WALL_WIDTH / 2, 0, 0], quat("y", math.pi / 2), extras={"hingeAxis": "+Y", "capturedBy": "right rolled wall"})
    front = node("CTRL_FrontWall", "Front_Wall", [0, 0, DEPTH / 2], children=[front_ext_l, front_ext_r, front_ext_seam_l, front_ext_seam_r], extras={"hingeAxis": "+X", "foldLine": "front bottom"})

    left_inner = node("CTRL_LeftInnerWall", "Side_Inner_Wall", [RAIL_WIDTH, 0, 0], extras={"hingeAxis": "+Z", "foldLine": "inside edge of left top rail"})
    left_inner_seam = node("SEAM_LeftRailInner", "SEAM_Fillet_Z_Depth", [RAIL_WIDTH, 0, 0])
    left_rail = node("CTRL_LeftTopRail", "Top_Rail_L", [0, HEIGHT, 0], children=[left_inner, left_inner_seam], extras={"hingeAxis": "+Z", "foldLine": "top of left outer wall", "railWidthInches": RAIL_WIDTH / INCH})
    left_rail_seam = node("SEAM_LeftOuterRail", "SEAM_Fillet_Z_Depth", [0, HEIGHT, 0])
    left_outer = node("CTRL_LeftOuterWall", "Side_Outer_Wall", [-WIDTH / 2, 0, 0], children=[left_rail, left_rail_seam], extras={"hingeAxis": "+Z", "foldLine": "left bottom"})

    right_inner = node("CTRL_RightInnerWall", "Side_Inner_Wall", [-RAIL_WIDTH, 0, 0], extras={"hingeAxis": "-Z", "foldLine": "inside edge of right top rail"})
    right_inner_seam = node("SEAM_RightRailInner", "SEAM_Fillet_Z_Depth", [-RAIL_WIDTH, 0, 0])
    right_rail = node("CTRL_RightTopRail", "Top_Rail_R", [0, HEIGHT, 0], children=[right_inner, right_inner_seam], extras={"hingeAxis": "-Z", "foldLine": "top of right outer wall", "railWidthInches": RAIL_WIDTH / INCH})
    right_rail_seam = node("SEAM_RightOuterRail", "SEAM_Fillet_Z_Depth", [0, HEIGHT, 0])
    right_outer = node("CTRL_RightOuterWall", "Side_Outer_Wall", [WIDTH / 2, 0, 0], children=[right_rail, right_rail_seam], extras={"hingeAxis": "-Z", "foldLine": "right bottom"})

    tuck_ear_seam_l = node("SEAM_TuckEar_L", "SEAM_Fillet_Y_Wall", [-TUCK_WIDTH / 2, -HEIGHT / 2, 0])
    tuck_ear_seam_r = node("SEAM_TuckEar_R", "SEAM_Fillet_Y_Wall", [TUCK_WIDTH / 2, -HEIGHT / 2, 0])
    tuck_ear_l = node("CTRL_TuckEar_L", "Tuck_Ear_L_QuarterCircle", [-TUCK_WIDTH / 2, 0, 0], rotation=quat("y", math.radians(EAR_OPEN_DEGREES - 90)), extras={"hingeAxis": "-Y", "radiusInches": 2.0, "upperReliefMeters": EAR_TOP_RELIEF, "seatsIn": "left rail", "openingTravelDegrees": EAR_OPEN_DEGREES})
    tuck_ear_r = node("CTRL_TuckEar_R", "Tuck_Ear_R_QuarterCircle", [TUCK_WIDTH / 2, 0, 0], rotation=quat("y", math.radians(90 - EAR_OPEN_DEGREES)), extras={"hingeAxis": "+Y", "radiusInches": 2.0, "upperReliefMeters": EAR_TOP_RELIEF, "seatsIn": "right rail", "openingTravelDegrees": EAR_OPEN_DEGREES})
    tuck = node("CTRL_TuckFlap", "Tuck_Flap_Rectangle", [0, 0, LID_DEPTH], rotation=quat("x", math.radians(-60)), children=[tuck_ear_l, tuck_ear_r, tuck_ear_seam_l, tuck_ear_seam_r], extras={"hingeAxis": "+X", "foldLine": "lid front", "dimensionsInches": [TUCK_WIDTH / INCH, HEIGHT / INCH], "openAngleDegrees": -60})
    wing_l = node("CTRL_LidWing_L", "Lid_Wing_L", [-LID_WIDTH / 2, 0, 0], quat("z", math.radians(-WING_OPEN_DEGREES)), extras={"hingeAxis": "+Z", "heightInches": WING_HEIGHT / INCH, "openAngleDegrees": -WING_OPEN_DEGREES})
    wing_r = node("CTRL_LidWing_R", "Lid_Wing_R", [LID_WIDTH / 2, 0, 0], quat("z", math.radians(WING_OPEN_DEGREES)), extras={"hingeAxis": "-Z", "heightInches": WING_HEIGHT / INCH, "openAngleDegrees": WING_OPEN_DEGREES})
    tuck_seam = node("SEAM_LidTuck", "SEAM_Fillet_X_Lid", [0, 0, LID_DEPTH])
    wing_seam_l = node("SEAM_LidWing_L", "SEAM_Fillet_Z_Depth", [-LID_WIDTH / 2, 0, DEPTH / 2])
    wing_seam_r = node("SEAM_LidWing_R", "SEAM_Fillet_Z_Depth", [LID_WIDTH / 2, 0, DEPTH / 2])
    lid = node("CTRL_Lid", "Lid_Main_Narrow", [0, BACK_HEIGHT, 0], quat("x", -math.pi), [tuck, wing_l, wing_r, tuck_seam, wing_seam_l, wing_seam_r], {"hingeAxis": "-X", "foldLine": "top of back wall", "widthInches": LID_WIDTH / INCH, "depthInches": LID_DEPTH / INCH})

    rear_ext_seam_l = node("SEAM_RearExtension_L", "SEAM_Fillet_Y_Wall", [-END_WALL_WIDTH / 2, HEIGHT / 2, 0])
    rear_ext_seam_r = node("SEAM_RearExtension_R", "SEAM_Fillet_Y_Wall", [END_WALL_WIDTH / 2, HEIGHT / 2, 0])
    lid_seam = node("SEAM_BackLid", "SEAM_Fillet_X_Lid", [0, BACK_HEIGHT, 0])
    rear_ext_l = node("CTRL_RearExtension_L", "Rear_Extension_L", [-END_WALL_WIDTH / 2, 0, 0], quat("y", math.pi / 2), extras={"hingeAxis": "+Y", "capturedBy": "left rolled wall"})
    rear_ext_r = node("CTRL_RearExtension_R", "Rear_Extension_R", [END_WALL_WIDTH / 2, 0, 0], quat("y", -math.pi / 2), extras={"hingeAxis": "-Y", "capturedBy": "right rolled wall"})
    back = node("CTRL_BackWall", "Back_Wall", [0, 0, -DEPTH / 2], children=[rear_ext_l, rear_ext_r, lid, rear_ext_seam_l, rear_ext_seam_r, lid_seam], extras={"hingeAxis": "-X", "foldLine": "back bottom"})

    floor_seam_front = node("SEAM_BottomFront", "SEAM_Fillet_X_Tray", [0, 0, DEPTH / 2])
    floor_seam_back = node("SEAM_BottomBack", "SEAM_Fillet_X_Tray", [0, 0, -DEPTH / 2])
    floor_seam_left = node("SEAM_BottomLeft", "SEAM_Fillet_Z_Depth", [-WIDTH / 2, 0, 0])
    floor_seam_right = node("SEAM_BottomRight", "SEAM_Fillet_Z_Depth", [WIDTH / 2, 0, 0])

    root = node("RIG_CardboardMailer_SeamFilledV4", children=[bottom, front, left_outer, right_outer, back, floor_seam_front, floor_seam_back, floor_seam_left, floor_seam_right], extras={
        "dimensionsInches": [7.0, 7.0, 2.0],
        "frontRearWallWidthInches": END_WALL_WIDTH / INCH,
        "frontRearWallInsetPerEndInches": WALL_INSET / INCH,
        "layerClearanceInches": FIT_CLEARANCE / INCH,
        "lidWidthInches": LID_WIDTH / INCH,
        "lidDepthInches": LID_DEPTH / INCH,
        "backWallHeightInches": BACK_HEIGHT / INCH,
        "tuckWidthInches": TUCK_WIDTH / INCH,
        "earInsetInches": EAR_INSET / INCH,
        "earTopReliefInches": EAR_TOP_RELIEF / INCH,
        "tuckPlacement": "outside front wall",
        "wingPlacement": "inside inner return walls",
        "lidInsetPerSideInches": LID_INSET / INCH,
        "railWidthInches": RAIL_WIDTH / INCH,
        "cornerExtensionLengthInches": EXTENSION_LENGTH / INCH,
        "creaseWidthInches": CREASE_WIDTH / INCH,
        "boardThicknessMM": THICKNESS * 1000,
        "rigType": "hierarchical hinge rig with procedural rotational seam fillets",
        "construction": "single-sheet rolled-side mailer",
        "dielineCuts": "four corner slits separate front/rear extensions from side-wall strips",
        "foldTreatment": "18 kraft hinge fillets mathematically close the pivots; corrugated edge material remains on true panel cuts",
        "defaultPose": "open",
    })

    # Replace the old pivot covers with scored panels and genuinely deforming
    # liner strips. Keep control names and nominal hinge locations compatible.
    from cardboard_folds import rebuild_fold_geometry
    mesh_data = rebuild_fold_geometry(nodes, mesh_data, root, MeshData,
                                      matrix_from_trs, THICKNESS, CREASE_WIDTH,
                                      FIT_CLEARANCE, KRAFT_TILE_SIZE)
    meshes = [None] * len(mesh_data)
    builder = GLBBuilder()
    for mi, md in enumerate(mesh_data):
        prims = []
        for material, p in md.primitives.items():
            if not p.indices:
                continue
            index_type = 5123 if len(p.positions) < 65536 else 5125
            prims.append({
                "attributes": {
                    "POSITION": builder.array(p.positions, 5126, "VEC3", 34962, True),
                    "NORMAL": builder.array(p.normals, 5126, "VEC3", 34962),
                    "TEXCOORD_0": builder.array(p.uvs, 5126, "VEC2", 34962),
                },
                "indices": builder.array(p.indices, index_type, "SCALAR", 34963),
                "material": material,
                "mode": 4,
            })
            if p.weights:
                prims[-1]["attributes"].update({
                    "JOINTS_0": builder.array(p.joints, 5123, "VEC4", 34962),
                    "WEIGHTS_0": builder.array(p.weights, 5126, "VEC4", 34962),
                })
        meshes[mi] = {"name": md.name, "primitives": prims}

    skins = []
    for nd in nodes:
        if "mesh" not in nd:
            continue
        md = mesh_data[nd["mesh"]]
        if md.skin_joints:
            nd["skin"] = len(skins)
            skins.append({"name": nd["name"] + "_Skin", "joints": md.skin_joints,
                          "inverseBindMatrices": builder.array(
                              [m.T.reshape(16) for m in md.inverse_bind], 5126, "MAT4")})

    images = []
    for name, image in zip(["Kraft_Albedo", "Kraft_Normal", "Kraft_ORM"], textures):
        f = io.BytesIO()
        image.save(f, format="PNG", optimize=True)
        view = builder.blob(f.getvalue())
        images.append({"name": name, "bufferView": view, "mimeType": "image/png"})

    def rotation_track(node_index, keys):
        times = [k[0] for k in keys]
        values = [k[1] for k in keys]
        return node_index, builder.array(times, 5126, "SCALAR", include_bounds=True), builder.array(values, 5126, "VEC4")

    def make_animation(name, tracks):
        samplers, channels = [], []
        for node_index, input_acc, output_acc in tracks:
            samplers.append({"input": input_acc, "output": output_acc, "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": node_index, "path": "rotation"}})
        return {"name": name, "samplers": samplers, "channels": channels}

    # Match the portfolio's accepted staging exactly; dense quaternion keys
    # preserve its smooth curve in ordinary glTF animation players too.
    from generate_open_close_gif import rig_pose
    named_nodes = {n['name']: i for i, n in enumerate(nodes)}
    def motion_clip(name, closing):
        tracks = {}
        for time in np.linspace(0, 1.55, 49):
            amount = time / 1.55 if closing else 1 - time / 1.55
            for i, q in rig_pose(named_nodes, amount).items():
                tracks.setdefault(i, []).append((float(time), q))
        return make_animation(name, [rotation_track(i, keys) for i, keys in tracks.items()])
    anim_open = motion_clip('Open_Lid', False)
    anim_close = motion_clip('Close_Lid', True)
    anim_fold = make_animation("Fold_Tray_Walls", [
        rotation_track(front, [(0, quat("x", math.pi / 2)), (1.2, quat("x", 0))]),
        rotation_track(back, [(0, quat("x", -math.pi / 2)), (1.2, quat("x", 0))]),
        rotation_track(left_outer, [(0, quat("z", math.pi / 2)), (1.2, quat("z", 0))]),
        rotation_track(right_outer, [(0, quat("z", -math.pi / 2)), (1.2, quat("z", 0))]),
        rotation_track(front_ext_l, [(0, quat("y", 0)), (1.2, quat("y", -math.pi / 2))]),
        rotation_track(front_ext_r, [(0, quat("y", 0)), (1.2, quat("y", math.pi / 2))]),
        rotation_track(rear_ext_l, [(0, quat("y", 0)), (1.2, quat("y", math.pi / 2))]),
        rotation_track(rear_ext_r, [(0, quat("y", 0)), (1.2, quat("y", -math.pi / 2))]),
    ])
    anim_ears = make_animation("Fold_Tuck_Ears_Into_Rails", [
        rotation_track(tuck_ear_l, [(0, quat("y", 0)), (0.8, quat("y", -math.pi / 2))]),
        rotation_track(tuck_ear_r, [(0, quat("y", 0)), (0.8, quat("y", math.pi / 2))]),
    ])
    anim_reveal = make_animation("Reveal_Rolled_Wall_Layers", [
        rotation_track(left_inner, [(0, quat("z", 0)), (0.8, quat("z", math.radians(34)))]),
        rotation_track(right_inner, [(0, quat("z", 0)), (0.8, quat("z", math.radians(-34)))]),
    ])

    gltf = {
        "asset": {"version": "2.0", "generator": "Codex procedural dieline-mailer builder", "copyright": "Original procedural asset"},
        "scene": 0,
        "scenes": [{"name": "Cardboard Mailer V4 — Open", "nodes": [root]}],
        "nodes": nodes,
        "meshes": meshes,
        "skins": skins,
        "materials": [
            {
                "name": "MAT_Kraft_Cardboard",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicRoughnessTexture": {"index": 2},
                    "metallicFactor": 0.0,
                    "roughnessFactor": 1.0,
                },
                "normalTexture": {"index": 1, "scale": 0.42},
                "occlusionTexture": {"index": 2, "strength": 0.65},
                "doubleSided": True,
            },
            {
                "name": "MAT_Cut_Cardboard_Edges",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "baseColorFactor": [0.62, 0.48, 0.31, 1.0],
                    "metallicRoughnessTexture": {"index": 2},
                    "metallicFactor": 0.0,
                    "roughnessFactor": 1.0,
                },
                "normalTexture": {"index": 1, "scale": 0.55},
                "doubleSided": True,
            },
        ],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "textures": [
            {"name": "TEX_Kraft_Albedo", "sampler": 0, "source": 0},
            {"name": "TEX_Kraft_Normal", "sampler": 0, "source": 1},
            {"name": "TEX_Kraft_ORM", "sampler": 0, "source": 2},
        ],
        "images": images,
        "animations": [anim_open, anim_close, anim_fold, anim_ears, anim_reveal],
        "bufferViews": builder.buffer_views,
        "accessors": builder.accessors,
        "buffers": [{"byteLength": 0}],
        "extensionsUsed": ["KHR_materials_specular"],
        "extensions": {},
        "extras": {
            "dimensions": {"bottom": "7 × 7 in", "height": "2 in", "frontRearWallWidth": f"{END_WALL_WIDTH / INCH:.2f} in", "wallInsetPerEnd": f"{WALL_INSET / INCH:.3f} in", "lidWidth": f"{LID_WIDTH / INCH:.2f} in", "railWidth": "0.20 in", "boardThickness": "0.06 in", "creaseWidth": "0.10 in"},
            "construction": "Rolled double side walls with four cut-separated corner extensions, captured front/rear tabs, and separately hinged quarter-circle tuck ears.",
        "notes": "Eighteen scored, two-joint skinned liner strips connect trimmed rigid panels. True cuts and crease-end reliefs expose core; fold interiors do not. Visual bend approximation, not a physical cardboard simulation.",
        },
    }
    for material in gltf["materials"]:
        material["extensions"] = {"KHR_materials_specular": {"specularFactor": 0.22}}
    return gltf, builder.binary, mesh_data


def write_glb(gltf, binary, path: Path):
    align4(binary)
    gltf["buffers"][0]["byteLength"] = len(binary)
    js = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    while len(js) % 4:
        js += b" "
    total = 12 + 8 + len(js) + 8 + len(binary)
    with path.open("wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(binary), b"BIN\x00"))
        f.write(binary)


def matrix_from_trs(node, rotation_override=None):
    t = np.asarray(node.get("translation", [0, 0, 0]), dtype=float)
    x, y, z, w = rotation_override or node.get("rotation", [0, 0, 0, 1])
    r = np.array([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*z*w, 2*x*z + 2*y*w, 0],
        [2*x*y + 2*z*w, 1 - 2*x*x - 2*z*z, 2*y*z - 2*x*w, 0],
        [2*x*z - 2*y*w, 2*y*z + 2*x*w, 1 - 2*x*x - 2*y*y, 0],
        [0, 0, 0, 1],
    ], dtype=float)
    r[:3, 3] = t
    return r


def render_preview(gltf, mesh_data, albedo: Image.Image, pose="open", size=900, rotation_overrides=None):
    """Small dependency-free triangle renderer for a trustworthy asset preview."""
    node_by_name = {n["name"]: i for i, n in enumerate(gltf["nodes"])}
    overrides = {}
    if pose == "closed":
        overrides[node_by_name["CTRL_Lid"]] = quat("x", 0)
        overrides[node_by_name["CTRL_LidWing_L"]] = quat("z", 0)
        overrides[node_by_name["CTRL_LidWing_R"]] = quat("z", 0)
        overrides[node_by_name["CTRL_TuckFlap"]] = quat("x", 0)
        overrides[node_by_name["CTRL_TuckEar_L"]] = quat("y", -math.pi / 2)
        overrides[node_by_name["CTRL_TuckEar_R"]] = quat("y", math.pi / 2)
    elif pose == "flat":
        from cardboard_folds import flat_rotations
        overrides.update(flat_rotations(gltf["nodes"]))
    elif pose == "construction":
        overrides[node_by_name["CTRL_FrontWall"]] = quat("x", math.radians(34))
        overrides[node_by_name["CTRL_BackWall"]] = quat("x", math.radians(-22))
        overrides[node_by_name["CTRL_LeftOuterWall"]] = quat("z", math.radians(28))
        overrides[node_by_name["CTRL_RightOuterWall"]] = quat("z", math.radians(-28))
        overrides[node_by_name["CTRL_FrontExtension_L"]] = quat("y", math.radians(-54))
        overrides[node_by_name["CTRL_FrontExtension_R"]] = quat("y", math.radians(54))
        overrides[node_by_name["CTRL_RearExtension_L"]] = quat("y", math.radians(54))
        overrides[node_by_name["CTRL_RearExtension_R"]] = quat("y", math.radians(-54))
        overrides[node_by_name["CTRL_LeftInnerWall"]] = quat("z", math.radians(30))
        overrides[node_by_name["CTRL_RightInnerWall"]] = quat("z", math.radians(-30))
        overrides[node_by_name["CTRL_Lid"]] = quat("x", math.radians(-132))
    if rotation_overrides:
        overrides.update(rotation_overrides)

    instances = []
    world = {}
    def walk(idx, parent):
        m = parent @ matrix_from_trs(gltf["nodes"][idx], overrides.get(idx))
        world[idx] = m
        if "mesh" in gltf["nodes"][idx]:
            instances.append((gltf["nodes"][idx]["mesh"], m))
        for child in gltf["nodes"][idx].get("children", []):
            walk(child, m)
    walk(gltf["scenes"][0]["nodes"][0], np.eye(4))

    if pose == "closed":
        eye, target = np.array([0.29, 0.235, 0.30]), np.array([0.0, 0.025, 0.0])
    elif pose == "flat":
        eye, target = np.array([0.004, 0.72, -0.115]), np.array([0.0, 0.0, -0.115])
    elif pose == "construction":
        eye, target = np.array([0.34, 0.30, 0.44]), np.array([0.0, 0.015, -0.035])
    elif pose == "animation":
        # Frame the swept volume, including the extended apron when the lid
        # passes upright. The old camera cropped the top in those poses.
        eye, target = np.array([0.3472, 0.28796, 0.4658]), np.array([0.0, 0.055, -0.055])
    else:
        eye, target = np.array([0.29, 0.235, 0.39]), np.array([0.0, 0.025, -0.075])
    forward = target - eye
    forward /= np.linalg.norm(forward)
    up_reference = (
        np.array([0.0, 0.0, -1.0])
        if abs(float(forward @ np.array([0.0, 1.0, 0.0]))) > 0.95
        else np.array([0.0, 1.0, 0.0])
    )
    right = np.cross(forward, up_reference); right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    f = size * 1.22

    canvas = np.zeros((size, size, 3), dtype=np.uint8)
    yy = np.linspace(0, 1, size)[:, None]
    bg = np.array([43, 46, 49])[None, None, :] * (1 - yy[:, :, None] * 0.18)
    canvas[:] = np.broadcast_to(bg, canvas.shape).astype(np.uint8)
    zbuf = np.full((size, size), np.inf, dtype=float)
    texture = np.asarray(albedo.resize((512, 512), Image.Resampling.LANCZOS))
    light = np.array([-0.35, 0.84, 0.42]); light /= np.linalg.norm(light)

    triangles = []
    for mesh_idx, m in instances:
        normal_m = m[:3, :3]
        for material, prim in mesh_data[mesh_idx].primitives.items():
            if not prim.indices:
                continue
            p = np.asarray(prim.positions, dtype=float)
            n = np.asarray(prim.normals, dtype=float)
            uv = np.asarray(prim.uvs, dtype=float)
            md = mesh_data[mesh_idx]
            if md.skin_joints:
                transforms = [world[j] @ inv for j, inv in zip(md.skin_joints, md.inverse_bind)]
                weights = np.asarray(prim.weights)
                wp = sum(weights[:, k:k+1] * (np.c_[p, np.ones(len(p))] @ tr.T)[:, :3]
                         for k, tr in enumerate(transforms))
                wn = sum(weights[:, k:k+1] * (n @ tr[:3, :3].T)
                         for k, tr in enumerate(transforms))
            else:
                wp = (m @ np.c_[p, np.ones(len(p))].T).T[:, :3]
                wn = (normal_m @ n.T).T
            wn /= np.maximum(np.linalg.norm(wn, axis=1, keepdims=True), 1e-9)
            for a, b, c in np.asarray(prim.indices).reshape(-1, 3):
                triangles.append((wp[[a,b,c]], wn[[a,b,c]], uv[[a,b,c]], material))

    # Painter-compatible ordering plus a per-pixel z-buffer.
    triangles.sort(key=lambda t: -float(np.mean(np.linalg.norm(t[0] - eye, axis=1))))
    for pts, normals, uvs, material in triangles:
        rel = pts - eye
        cam_x = rel @ right
        cam_y = rel @ up
        cam_z = rel @ forward
        if np.any(cam_z <= 0.01):
            continue
        sx = size / 2 + f * cam_x / cam_z
        sy = size / 2 - f * cam_y / cam_z
        spts = np.c_[sx, sy]
        minx = max(0, int(np.floor(sx.min()))); maxx = min(size - 1, int(np.ceil(sx.max())))
        miny = max(0, int(np.floor(sy.min()))); maxy = min(size - 1, int(np.ceil(sy.max())))
        if minx > maxx or miny > maxy:
            continue
        x0,y0 = spts[0]; x1,y1 = spts[1]; x2,y2 = spts[2]
        denom = (y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(denom) < 1e-8:
            continue
        gx, gy = np.meshgrid(np.arange(minx, maxx+1)+0.5, np.arange(miny, maxy+1)+0.5)
        w0 = ((y1-y2)*(gx-x2)+(x2-x1)*(gy-y2))/denom
        w1 = ((y2-y0)*(gx-x2)+(x0-x2)*(gy-y2))/denom
        w2 = 1-w0-w1
        inside = (w0 >= -1e-5) & (w1 >= -1e-5) & (w2 >= -1e-5)
        inv_depth = w0/cam_z[0] + w1/cam_z[1] + w2/cam_z[2]
        depth = 1.0 / np.maximum(inv_depth, 1e-12)
        region_z = zbuf[miny:maxy+1, minx:maxx+1]
        mask = inside & (depth < region_z)
        if not np.any(mask):
            continue
        pw0 = (w0/cam_z[0]) / np.maximum(inv_depth, 1e-12)
        pw1 = (w1/cam_z[1]) / np.maximum(inv_depth, 1e-12)
        pw2 = (w2/cam_z[2]) / np.maximum(inv_depth, 1e-12)
        uv_interp = pw0[...,None]*uvs[0]+pw1[...,None]*uvs[1]+pw2[...,None]*uvs[2]
        tx = np.mod((uv_interp[...,0]*texture.shape[1]).astype(int), texture.shape[1])
        ty = np.mod(((1-uv_interp[...,1])*texture.shape[0]).astype(int), texture.shape[0])
        color = texture[ty,tx].astype(float)
        if material == 1: color *= np.array([0.64,0.52,0.38])
        n_interp = pw0[...,None]*normals[0]+pw1[...,None]*normals[1]+pw2[...,None]*normals[2]
        n_interp /= np.maximum(np.linalg.norm(n_interp,axis=2,keepdims=True),1e-9)
        lum = 0.34 + 0.72*np.maximum(0,n_interp@light)
        color = np.clip(color*lum[...,None],0,255)
        region = canvas[miny:maxy+1, minx:maxx+1]
        region[mask] = color[mask].astype(np.uint8)
        region_z[mask] = depth[mask]

    img = Image.fromarray(canvas).filter(ImageFilter.GaussianBlur(0.25))
    return img


def make_contact_sheet(open_img, construction_img):
    sheet = Image.new("RGB", (1840, 1030), (26, 28, 30))
    sheet.paste(open_img, (20, 72)); sheet.paste(construction_img, (920, 72))
    draw = ImageDraw.Draw(sheet)
    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 30)
        small_font = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 21)
    except OSError:
        title_font = small_font = ImageFont.load_default()
    draw.text((26, 22), "OPEN / DEFAULT POSE", fill=(235,235,232), font=title_font)
    draw.text((926, 22), "PARTLY FOLDED / CONSTRUCTION", fill=(235,235,232), font=title_font)
    draw.text((28, 986), "7 × 7 × 2 in  •  18 hinge controls  •  18 bending score strips  •  core visible only at cuts / reliefs", fill=(205,190,165), font=small_font)
    sheet.save(OUT / "cardboard_mailer_v4_preview.png", optimize=True)


def validate_glb(path: Path):
    raw = path.read_bytes()
    magic, version, declared = struct.unpack_from("<4sII", raw, 0)
    assert magic == b"glTF" and version == 2 and declared == len(raw)
    json_len, json_type = struct.unpack_from("<I4s", raw, 12)
    assert json_type == b"JSON"
    doc = json.loads(raw[20:20+json_len])
    assert doc["asset"]["version"] == "2.0"
    assert len(doc["animations"]) == 5
    assert doc["buffers"][0]["byteLength"] > 0
    assert sum(node["name"].startswith("CTRL_") for node in doc["nodes"]) == 18
    assert sum(node["name"].startswith("SEAM_") for node in doc["nodes"]) == 18
    assert {primitive["material"] for mesh in doc["meshes"] for primitive in mesh["primitives"]} == {0, 1}
    return doc


def main():
    textures = make_textures()
    gltf, binary, mesh_data = build_scene(textures)
    output = OUT / "cardboard_mailer_v4_seam_filled_rigged.glb"
    write_glb(gltf, binary, output)
    validate_glb(output)
    open_img = render_preview(gltf, mesh_data, textures[0], pose="open")
    closed_img = render_preview(gltf, mesh_data, textures[0], pose="closed")
    construction_img = render_preview(gltf, mesh_data, textures[0], pose="construction")
    flat_img = render_preview(gltf, mesh_data, textures[0], pose="flat", size=1200)
    closed_img.save(OUT / "cardboard_mailer_v4_closed.png", optimize=True)
    flat_img.save(OUT / "cardboard_mailer_v4_flat.png", optimize=True)
    make_contact_sheet(open_img, construction_img)
    print(f"Wrote {output.name} ({output.stat().st_size / 1_000_000:.2f} MB)")
    print("Dimensions: 7.000 x 7.000 x 2.000 inches")
    print("Controls: 18 named CTRL_ hinge nodes")
    print("Folds: 18 named SEAM_ two-joint skinned score strips")
    print("Animations: Open_Lid, Close_Lid, Fold_Tray_Walls, Fold_Tuck_Ears_Into_Rails, Reveal_Rolled_Wall_Layers")


if __name__ == "__main__":
    main()
