# Public source, private photos, filtered deployment

## Public source policy

Application code, tools, tests, and the complete editable box/authoring assets
remain eligible for the public source repository. The box's material JPEGs are
not original portfolio photographs and remain part of that editable source.

Original JPEGs, library WebPs, import backups, private catalogs, photo asset
caches, and photo audit reports belong under ignored `localimages/`. Root
`public/images`, generated photo JSON, `public/testimgs`, caches, local agent
directories, and `.env` / `.env.*` are ignored. A sanitized `.env.example` is
allowed. Do not put credentials in the example or browser environment variables.

The five old sample photos were moved from `public/testimgs` to
`localimages/original-testimgs`, preserving their bytes. Commit their source-tree
removals when ready; ignore rules do not retroactively remove tracked files.
The historical per-photo audit now lives in `localimages/reports/`.

## Editorial source and migration

`localimages/photo-pages.json` is the full private catalog, including hidden,
unassigned, and unfinished pages. Page Studio reads/saves that file; backups and
undo behavior are unchanged. The first run preserves an old
`public/photo-pages.json` verbatim into the private location if no private file
exists. An existing private catalog always takes precedence.

`public/photo-pages.json` contains only visible pages referenced by visible,
nonempty galleries. Unknown/editor-only fields are stripped. Shared pages appear
once; their references and display ordering are preserved. `public/photo-assets.json`
contains only those gallery photos. The full conversion cache is private at
`localimages/photo-assets.json`.

Box selection is another explicit public placement: all selected box photos are
published even if they do not appear in a gallery. Hiding one placement does not
make a photo private when it is still used in another visible page or the box.
The legacy `/old` route remains available during development only, so it cannot
bypass the editor's publication choices.

## Build policy

`npm run photos:publish` prepares missing/outdated derivatives for currently
visible gallery photos and writes the visible-only manifests. The first run is
slower because the old JPEG-passthrough recipe must be replaced. Originals keep
their bytes and resolutions. Display derivatives are always re-encoded lossy
WebP at quality 82, color-converted to sRGB, with EXIF/GPS/XMP removed. Native
pixel dimensions remain available for zooming; "full" now means a compressed
full-resolution derivative, not the original file. Small responsive variants
use the same WebP recipe. Existing compressed, metadata-free bordered box prints
are reused; incompatible old box exports are backed up privately before conversion.

`npm run build` automatically runs that preparation, then builds with production
source maps disabled by checked-in code. Its final publication step replaces only
the disposable `build/images` tree with an explicit allowlist:

- selected gallery responsive variants;
- small/full compatibility URLs pointing to those same compressed derivatives;
- selected bordered box prints and their ordered manifest.

Unselected photos, original JPEGs, old unoptimized exports, obsolete variants,
sample photos, and unrelated manifests do not survive into the build. Files left
in `public/images` are a LOCAL cache, not the publication list. Originals and old
local exports are not deleted when you hide or remove a photo.

Page Studio refreshes a saved build using the same allowlist instead of copying
the private catalog or all cached assets into it. Final verification checks exact
manifest contents, file membership, content hashes, lossy WebP encoding, metadata,
and absence of source maps. Missing or invalid selected assets fail the build.

`npm run photos:optimize` remains a broader LOCAL audit/preparation tool for the
library/legacy references; it does not add those photos to the public selection.
Run `npm run photos:publish` or build afterward to refresh site manifests.

## Limits and release steps

These changes do not deploy, commit, push, or rewrite Git history. The existing
live site and older `gh-pages` commits remain public until a separately approved
deployment/history action. Even after redeployment, previously published files
can remain in repository history, browser/CDN caches, or someone else's copy.

Keep a separate private backup of `localimages`, especially the editable catalog.
A fresh source clone cannot recreate private photographs or drafts by itself.
Source maps being disabled does not make browser JavaScript private.

Checks:

```bash
python3 -m unittest discover -s scripts/page-studio -p 'test_*.py'
npm test -- --watchAll=false
npm run build
python3 scripts/prepare-public-photos.py --check-build
```
