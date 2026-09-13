# PhotoPortfolio

This small project is meant to be a simple way for me to display some of my favorite photos that I have taken over the last few years.

## Photo imports and folders

Original photos, drafts, and audit reports stay local and Git-ignored. Production
contains only selected, compressed WebP photo derivatives—not original JPEGs or
unoptimized library copies. See [the publication policy](docs/publication-policy.md).

Original JPEG exports and their WebPs use matching paths. Older photos can stay
directly under their year; new imports can use a named folder within the year:

```text
localimages/jpg/2026/infrared/DSCF7490-Edit.jpg
localimages/webp/2026/infrared/DSCF7490-Edit.webp
```

The September 7 infrared import has 19 JPEG/WebP pairs in these folders. Its
source and checksums are recorded in
`localimages/imports/2026-09-07-infrared-export/report.json`.

All 19 infrared JPEGs were refreshed from the same external-drive folder on
September 8, 2026. The updated masters, regenerated library WebPs and responsive
site assets are recorded in
`localimages/imports/infrared-refresh-20260909T015150Z/report.json`; its `previous/`
folder preserves the replaced local files. The first import report is historical.

Convert a single folder with `python3 localimages/scripts/convert_to_webp.py 2026/infrared`,
or use `2026` for the whole year. Running without arguments opens the original
year prompt. Conversion preserves subfolders and image dimensions, uses WebP
quality 60, and skips existing WebPs. Matching filenames in different folders
remain separate photos.

Page Studio provides year and folder filters. The box image selector groups its
photos by year and folder, loading thumbnails as they come into view. Both
selectors and the 2D preparation script preserve
these paths when preparing selected images or generating manifests. Grouping an
import does not add it to a gallery or the box. Photo files remain excluded from
Git; the preparation scripts are included.

## Editable 3D box / production bake

Use `npm start` for the full editable box and local inspection controls.
`npm run build` automatically bakes and validates the optimized assets;
`npm run preview` serves that production build locally on port 3001.
See [the scene workflow](docs/three-scene-workflow.md) for source files, setup,
inspection controls, and bake details. Neither command publishes the site.

## Page Studio (local editor)

Run `npm run photos:pages`, then open http://127.0.0.1:8767.
Python 3 and Pillow are required, just like the existing image-preparation tools.

- **Photo box** controls the photos on the home page, using the same library.
  It opens with the current box selection in the order visitors flip through it.
  Add with **+**, drag from the library, or filter by year/folder/search and choose
  **Add matching photos**. Already selected photos show a checkmark; **Not in box**
  filters them out. Edit a card's position number and press Enter or leave the field
  to move it directly; Escape cancels. You can also drag the cards, use arrows,
  or **Make first** to reorder. Each move is one Undo step.
  Removing a card keeps its original, gallery placements, and prepared export.
- Box and page changes share **Save changes**, Undo/Redo, draft recovery, and export.
  Save prepares new box prints using the existing selector's white-border routine,
  writes the ordered `public/images/threedimbox/manifest.json`, and refreshes an
  existing build preview using the same publication filter as a full build.
  A box-only save leaves the private page catalog untouched.
  **Preview saved box** opens the saved home page. Publishing stays separate.
- **All pages** is the independent page library. Create pages there, or choose
  a gallery to work with its pages. New pages and galleries start hidden.
- **Organize** shows an always-visible gallery list and a **Board / List** of page
  previews. Select pages for bulk visibility, sharing, or removal. Gallery and page
  order support dragging and arrow buttons. Board/List is a remembered view preference.
- Open a page to switch to **Edit page**. In a narrow editor window, **Pages** opens
  the gallery/page drawer so the canvas and photo library stay side by side. On
  phones, **Galleries** opens navigation in Organize and **Photos** opens the editor
  photo drawer. The save status remains visible at every width.
- **Gallery visibility** and **Page visibility** use explicit **Visible / Hidden**
  states. Page visibility applies everywhere that page is included; gallery visibility
  keeps its pages’ individual settings. The organizer explains when a gallery has no
  visible pages and offers a bulk Show action. Hidden/draft pages remain in the
  private catalog and are omitted from new public builds. A photo still used by
  another visible page or by the box remains public. Previous deployments and
  Git history are not erased by hiding content.
- Use **Add pages**, bulk **Add to gallery**, or **Manage gallery membership** in
  the page editor to share library pages between galleries. For example,
  create Favorites with the **+** beside Galleries, then add your favorite pages.
  Editing a shared page updates it in every gallery without making copies. Duplicate
  creates a separate, initially hidden page with independent photo details.
- **Remove from gallery** only removes membership. **Delete page** in All pages
  removes the page and every membership. Both support Undo; neither deletes photos.
- Reorder pages within a gallery using arrows or dragging. Each gallery has its own
  page order; rearranging All pages only changes the library order.
- Add, duplicate, and reorder pages. Add rows and drag photos into them,
  or select a row and use **+** on a library photo.
- A fixed insertion line follows either half of a photo while dragging. Drop on
  **Add row** to create a row, or use **Option/Alt + arrow keys** to move a focused
  photo within its row or to an adjacent row. Each move is one Undo step.
- Select a placed photo to edit its title/alt text, location, date, orientation,
  and its position within a row or across pages.
- **Move photo…** lets you choose any page, row, and position before moving;
  changing the destination fields does not move the photo until you confirm.
- Expand **Photo details** for metadata. Text edits are
  kept as you type, and one Undo step reverses a continuous text edit. Undo/redo
  also restores the selected gallery and page when their order changes.
- Filter the library by year or filename, and use **Unused here** to find photos
  that are not in the selected gallery. New imports remain in the library until
  you choose to place them.
- **Preview** hides editing controls and prevents draft changes. **Open local preview** shows saved content.
  Run `npm run build` once after changing site code to prepare that preview;
  subsequent page saves update an existing local build without recompiling it.
- Undo/redo and browser draft recovery protect work in progress. **Export draft**
  downloads a JSON copy. Changes affect the galleries and photo box after **Save changes**. Saving writes locally and prepares the required photo assets;
  publishing the site is a separate step.

The full gallery catalog lives in ignored `localimages/photo-pages.json`;
`public/photo-pages.json` is a generated visible-only projection. Box selection and ordering live
in `public/images/threedimbox/manifest.json`. The editor combines them in a draft
(with `boxPhotos` in viewing order), and saves them to their respective files.
Box manifest order remains compatible with the existing site’s reversed stack.
Both revisions are checked when saving, including changes made by the older selector.

The canonical gallery content is `localimages/photo-pages.json`. Version 2 stores independent
`pages` with stable IDs, titles, visibility, and photo rows; ordered `galleries`
reference those pages through `pageIds`. Version 1 catalogs and browser recovery
drafts are migrated when read, preserving contents and order. On first run, an
older public catalog is preserved verbatim in the private location before any
filtering. Existing private catalogs are never replaced by public projections.
The site reads both formats and
derives its routes and navigation from the visible galleries and visible pages.
It shows a loading/error state instead of falling back to previously visible content.
The original `src/photos.ts` remains for the local-only legacy `/old` collection.

Box changes create a separate `box-*.json` selection/manifest backup in
`localimages/page-studio-backups/`. Conversions finish before page or box content
is committed. Reordering reuses existing box exports without recompressing them.

Saving creates a catalog backup in `localimages/page-studio-backups/`, validates
photo references, rejects stale saves from another window, and prepares only
missing image variants for photos on visible pages in visible galleries. Hidden
and unassigned pages can be saved unfinished, without generating site assets.
Image preparation also creates responsive assets from the current JPEG exports
(or the library WebP when no JPEG exists). Existing legacy image pairs and
original exports are preserved. This editor binds to
localhost, is not included in the public site, and never deploys it.

Editor checks:

```bash
python3 -m unittest discover -s scripts/page-studio -p 'test_*.py'
node --test scripts/page-studio/model.test.js
node --test scripts/page-studio/ui.test.cjs
```


## Faster photo delivery

Run `npm run photos:optimize` after adding or replacing exports, then `npm run build`.
The command audits catalog references (including hidden pages), the legacy
collections, and the box selection. It writes a per-photo report to
`localimages/photo-loading-audit.json`. Use `npm run photos:optimize -- --audit-only`
for a read-only asset audit (the local report is still written).

- Keep clean JPEG masters under `localimages/jpg/` using the existing year/folder
  paths. The current JPEG takes precedence over any older matching library WebP.
  For the infrared photos with visible JPEG artifacts, re-export from the RAW or
  edited master at high JPEG quality (about 95). Recompressing the existing JPEG
  cannot recover lost detail. TIFF masters need a JPEG export for this pipeline.
- The generator makes compressed WebP quality 82 derivatives at
  480, 960, 1600 and 2560 pixels on the long edge. It never upscales,
  and drops a size if a larger version costs fewer bytes.
  These settings are a quality/size tradeoff, not a claim of universal optimality.
- Native resolution remains available as a newly compressed WebP, never a
  copied original JPEG or unoptimized library file. Pixels are converted to sRGB
  before encoding; public derivatives exclude EXIF/GPS/XMP/IPTC.
- Generated files live in `public/images/optimized/`, with content hashes in
  their names. The complete private cache is `localimages/photo-assets.json`.
  `public/photo-assets.json` maps only visible-gallery photo keys to real widths,
  byte sizes, placeholders and URLs. `npm run photos:publish` or a build refreshes
  that public subset; neither ignored file is intended for a source commit.
- Repeat runs reuse assets only when source content and the recipe match and
  the public files exist. Replace the JPEG and rerun the command to regenerate.
  Page Studio prepares responsive files during changed catalog saves and refreshes
  its build preview; an unchanged save is intentionally still a no-op.
- The gallery measures each image slot and uses `srcset`/`sizes`, loads the first
  page immediately, and starts the next page shortly before it scrolls into view.
  Fullscreen retains the clicked preview while its larger image loads. Once the
  current photo is ready, it preloads just the previous and next photos at their
  fullscreen display sizes, with low download priority and asynchronous decoding.
  These sizes update when the viewport changes; closing the viewer removes the
  preload elements. Loading failures have retry controls; Escape/arrows and
  keyboard focus work in fullscreen.
- The 3D scene is a separate JavaScript chunk, requested only on the box route.

Originals and old exports remain available locally. The optimized gallery
requests the new assets. The build publishes only approved compressed variants
and prunes unused images from its disposable output, without deleting local
originals or cached exports.

Photo loading checks: `npm test -- --watchAll=false --runInBand` and the Python
Page Studio tests above. `npm run build` verifies the production bundle.
