# Box and Three.js loading pass

2026-09-08. Local-only optimization; nothing deployed or committed.

## Measured asset payload

Decimal bytes, before HTTP compression; this is not a wall-clock speed benchmark.

| Assets | Before | After |
| --- | ---: | ---: |
| Box GLB | 2,127,772 | 717,836 |
| Wood textures requested by the scene | 3,139,249 | 324,354 |
| Initially requested photo textures | 4,485,364 (18) | 675,106 (3) |
| Subtotal | 9,752,385 | 1,717,296 |

That subtotal is 82.4% smaller. It excludes JavaScript, environment HDR,
fonts, manifests, CSS, and HTML; it is not the entire page transfer size.
It describes the first loading stage only. The remaining photos now start
automatically shortly afterward. Once all 18 finish, these assets total
5,527,554 bytes (43.3% below the original fully loaded subtotal).

The box keeps three 1024×1024 maps, now lossy WebP quality 95. Wood color and
normal maps use quality 90 at their original resolution. The unused wood
roughness-map request was removed: MeshToonMaterial does not use that property.
The original wood JPGs remain in public for easy comparison; they are no longer
requested by this scene. Removing their requests does not remove them from a
deployment archive.

All non-image GLB buffer data is byte-identical. Nodes, skins, UVs, materials,
animation tracks, timing, flap angles, dimensions, and geometry are unchanged.
The model remains four render pieces and seven joints. The URL version is v10.

## Loading behavior

- All 18 physical card positions remain. Unrequested faces use paper placeholders.
- Initially load indices 0, 1 and 17 in the existing reversed manifest order.
- Starting 600 ms after the manifest is available in the mounted scene, request
  the remaining photos in batches of three every 150 ms. All 18 have been
  requested after 1.2 seconds, even with no interaction. Download completion
  still depends on the connection. Navigating does not restart the timer.
- Browsing prioritizes the next neighbor in either direction. Already requested
  photos stay mounted so faces do not disappear when moved to the back. Timers
  are canceled when leaving the scene.
- Each face has its own Suspense and error boundary. A delayed or failed image
  cannot replace the entire scene with a loading screen. Failed faces retain
  their paper placeholder; a page reload retries them.
- Texture resolution and photo quality are unchanged. This defers downloads;
  all photos eventually load in the background. It is not a bounded GPU cache.
- Pointer events stop at the nearest stack hit. Previously a click continued
  through overlapping cards; functional state updates advanced once per hit,
  potentially wrapping all 18 photos back to the same one. Keyboard-only checks
  had missed this regression. Pointer-click regression tests now cover it.
- Removed two per-frame console logs. Existing route-level lazy loading in
  App.tsx was preserved, not rewritten by this pass.

## Reproduce / compare

Run from the portfolio root with Python 3 and Pillow installed:

```sh
python3 scripts/optimize-three-assets.py \
  --source ../rigged-cardboard-mailer/cardboard_mailer_web.glb
CI=true npm test -- --watchAll=false --runInBand
npm run build
```

Always encode from the lossless website GLB, never repeatedly from an already
lossy output. The editable master and its lossless web derivative were not edited.
The exact pre-pass website asset and component snapshots are also saved outside
the deploy directory at `../rigged-cardboard-mailer/revisions/loading-optimization-before/`.

Source SHA-256: `7455447056272d749b0c31ae97570400cdc32759a5e6a435620fb1245628df25`.
Optimized SHA-256: `42c89795c081ca810f98574569143077d700c0331576d1b4b1f7366ef86074f8`.

## Verification

- Encoder verifies every non-image buffer view and all scene metadata against
  the lossless source and decodes the result to verify texture dimensions.
- Automated tests cover all previous box-motion invariants, the three-photo
  loading window, forward/backward wrapping, retained faces, empty stacks,
  individual suspended images and failed images, background scheduling and
  cleanup, and consumption of pointer clicks rather than propagation behind
  the stack.
- Browser resource inventory confirms v10, two optimized wood maps, and only
  three first-stage photo requests in the original optimization pass. With the
  revised background policy, all 18 photo requests appear without clicking.
- Before/after production screenshots at the same open-box pose show consistent
  overall appearance; compression is lossy, not pixel-identical. Inside lettering
  and the arrow are preserved. Closed and open states and photo navigation were
  also checked in the visible development preview.
- Production build succeeds with existing MediaPipe source-map and Modal lint
  warnings. No new decoder or runtime dependency is introduced.

No cold-cache, throttled end-to-end timing claim is made. The production build
was rendered locally; download savings and functional behavior were verified.
