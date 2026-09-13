# Editable scene and production bake

There is one box/animation source and one site interaction implementation.
Development and production differ only in asset/rendering adapters.

## Daily commands

- `npm start`: editable 18-fold master, live text, original wood maps, hot reload.
  Expand **Box studio · development only** at the bottom left for the unfolded
  sheet, wireframe, orbit camera, photo visibility, or normal opening scrubber.
  **Return to site view** restores the usual camera, photos, and opening behavior.
- `npm run scene:bake`: regenerate only stale/missing/corrupt generated assets.
- `npm run build`: bake, build, then verify that production contains the current
  outputs and excludes the full source rig, inspector, and runtime text engine.
- `npm run preview`: serve that exact build at `http://127.0.0.1:3001`.
  Use `PORT=3002 npm run preview` if 3001 is occupied. This does not rebuild or deploy.
- `npm run scene:check`: asset-pipeline tests. Site tests: `npm test -- --watchAll=false`.

The bake needs Python 3.9+ on macOS/Linux (or WSL), plus Pillow and NumPy. On a new machine, install
`scripts/three-scene-requirements.txt` into your Python environment (prefer a
virtual environment), alongside the normal `npm ci` dependency install. The
versions are pinned to the current bake environment. Build-time dependencies do
not ship to visitors. Missing dependencies or invalid sources fail the build;
the build never silently publishes a stale export.

## What to edit

- **Panels, folds, UVs, and animation:**
  `src/ThreeDim/authoring/cardboard_mailer_v4_seam_filled_rigged.glb` is the full,
  editable master. Preserve its named `CTRL_*` nodes and `Open_Lid` / `Close_Lid`
  clips. All 18 crease skins, separate pieces, and the three inspection clips
  remain in this file. The development viewer can unfold it using its stored
  flat rotations; use a 3D editor or the original procedural authoring workflow
  for actual geometry edits. The viewer is an inspector, not a mesh editor.
- **Lettering and arrow:** `src/ThreeDim/sceneConfig.json` stores text, sizes,
  spacing, and transforms, including the original `C` + `^` arrow. The local
  `authoring/LOSTLATE.ttf` is the bake font. Development renders live text;
  production uses lossless transparent WebP decals with the same transforms.
  The current baker handles ASCII labels; it rejects complex-script text rather
  than baking incorrectly shaped glyphs. Add a shaping-aware baker if needed.
- **Light intensity/background blur/display scale:** also `sceneConfig.json`.
  Keep `modelWidthInches` consistent with the master when resizing the box.
- **Wood:** the original `authoring/Wood051_1K-JPG_*` files.
- **Scroll feel:** `boxMotion.ts` and `boxScrollPacing.json`, shared in both modes.
  The camera, photo cycling, progressive loading, and click handlers are also shared.

The original sibling `rigged-cardboard-mailer` project has not been changed.
Its current full GLB was copied into this repository so builds are self-contained.
Future edits to that sibling are **not** imported automatically: deliberately
replace the repo's authoring master after checking the new version.
`scripts/box-authoring` contains the original exporter and its geometry/validation
helpers; the ordinary bake exports the saved master, not a regenerated design.

## What the bake does

1. Combine fixed panels/folds into the static tray and keep a compact moving skin:
   2 meshes, 4 material primitives, 7 joints, and the two opening/closing clips.
2. Compare every triangle, normal, and UV against the master at 202 sampled poses.
   Then compress only embedded textures, proving all non-texture bytes unchanged.
3. Generate the compressed wood maps and lossless ink textures. Font baselines
   use the same OpenType typography metrics as the development text renderer.
4. Generate `src/ThreeDim/generated/scene-assets.json` with content-based URL
   versions. It is generated data: do not edit it or baked assets by hand.

Sources are never overwritten. Generated assets live under `public/models` and
`public/textures`; keep them and the generated manifest with the repository.
Cache fingerprints and the detailed bake report live in ignored
`.cache/three-scene/`. A missing or altered output forces the corresponding stage
to rebuild; unchanged outputs retain their timestamps. A code/config change uses
hot reload in development. Concurrent bake commands serialize using a local lock.
Run the bake/build to refresh the production preview.

The baked GLB remains 717,836 bytes (the same geometry, rig, and texture quality
as before this workflow). Labels add about 35 KB, replacing the runtime text
engine. The first verified production 3D dependency chunk fell from approximately
314 KB to 264 KB gzip. These are byte measurements, not a measured load-time gain.

Lighting, camera movement, skinning, and photo interactions remain live. This is
not a video or a pre-rendered scene. HDR environment loading is still unchanged;
self-hosting/preprocessing it can be a separate optimization.

`postbuild` filters portfolio photos/manifests using the
[publication policy](publication-policy.md), excludes source maps, and also removes
three obsolete source copies from the disposable build folder (the public TTF
and two wood JPGs). Their originals remain in the repo;
the header's separately bundled CSS font is unaffected. Nothing is committed,
published, or deployed by any of the scene commands.
