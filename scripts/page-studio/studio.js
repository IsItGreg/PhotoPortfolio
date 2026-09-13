import {
  clone,
  slugify,
  photoCount,
  moveItem,
  movePhoto,
  photoInsertionIndex,
  draftIsValid,
  migrateCatalog,
  pagesForGallery,
  galleriesForPage,
  attachPage,
  detachPage,
  deletePage,
  visibleGalleries,
} from "./model.js";
import { createOrganizer } from "./organizer.js";
import { createBoxStudio } from "./box-studio.js";
const $ = (id) => document.getElementById(id);
const STORAGE = "photoportfolio-page-studio-v1";
let catalog,
  saved,
  revision,
  boxRevision,
  library = [],
  galleryIndex = -1,
  pageIndex = 0,
  rowIndex = 0,
  selection = null;
let undo = [],
  redo = [],
  saving = false,
  preview = false,
  recovery = null,
  dialogMode = "new";
let workspaceView = "organize";
let panelView = null;
let textEditGroup = null;
let detailsOpen = false;
let photoDrag = null,
  dragFrame = null,
  moveSource = null;
const h = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on"))
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "style") Object.assign(node.style, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(
    ...children.filter((child) => child !== null && child !== undefined),
  );
  return node;
};
const button = (label, action, attrs = {}) =>
  h("button", { type: "button", onclick: action, ...attrs }, label);
const thumb = (key) => "/api/thumb?key=" + encodeURIComponent(key);
const photoUrl = (key) => "/api/photo?key=" + encodeURIComponent(key);
const gallery = () => catalog.galleries[galleryIndex];
const pages = () =>
  gallery() ? pagesForGallery(catalog, gallery()) : catalog.pages;
const pageOrder = () => (gallery() ? gallery().pageIds : catalog.pages);
const page = () => pages()[pageIndex];
function createPage(original = null) {
  const created = {
    id: "page-" + crypto.randomUUID(),
    title: original ? original.title.slice(0, 115) + " copy" : "Untitled page",
    visible: false,
    rows: original ? clone(original.rows) : [[]],
  };
  catalog.pages.push(created);
  if (gallery()) gallery().pageIds.splice(pageIndex + 1, 0, created.id);
  pageIndex = pages().findIndex((p) => p.id === created.id);
  rowIndex = 0;
  selection = null;
  return created;
}
const dirty = () => JSON.stringify(catalog) !== JSON.stringify(saved);
function notify(text = "") {
  $("message").hidden = !text;
  $("message").replaceChildren(
    h("span", {}, text),
    button("Dismiss", () => notify()),
  );
}
function persist() {
  try {
    if (dirty())
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ catalog, revision, boxRevision }),
      );
    else localStorage.removeItem(STORAGE);
  } catch {
    notify(
      "Your browser could not keep a recovery copy. Export the draft or save your pages before closing.",
    );
  }
}
function normalizeSelection() {
  galleryIndex = Math.max(
    -1,
    Math.min(galleryIndex, catalog.galleries.length - 1),
  );
  pageIndex = Math.max(0, Math.min(pageIndex, pages().length - 1));
  rowIndex = Math.max(0, Math.min(rowIndex, (page()?.rows.length || 1) - 1));
  if (selection && !page()?.rows[selection.row]?.[selection.index])
    selection = null;
}
function checkpoint() {
  return {
    catalog: clone(catalog),
    view: {
      mode: workspaceView,
      selectedIds: organizer.selectedIds(),
      galleryId: gallery()?.id ?? null,
      pageId: page()?.id ?? null,
      rowIndex,
      selection: clone(selection),
    },
  };
}
function update(action, { group = null, refresh = true } = {}) {
  if (saving || preview) return;
  const previous = checkpoint();
  action(catalog);
  if (JSON.stringify(previous.catalog) !== JSON.stringify(catalog)) {
    if (!group || group !== textEditGroup) undo.push(previous);
    textEditGroup = group;
    undo = undo.slice(-60);
    redo = [];
    persist();
  }
  normalizeSelection();
  if (refresh) render();
  else renderStatus();
}
function history(direction) {
  if (saving || preview) return;
  endPhotoDrag();
  const source = direction === "undo" ? undo : redo;
  const destination = direction === "undo" ? redo : undo;
  if (!source.length) return;
  destination.push(checkpoint());
  const entry = source.pop();
  catalog = entry.catalog;
  workspaceView = entry.view.mode || "edit";
  organizer.restoreSelection(entry.view.selectedIds);
  galleryIndex = catalog.galleries.findIndex(
    (g) => g.id === entry.view.galleryId,
  );
  pageIndex = pages().findIndex((p) => p.id === entry.view.pageId);
  rowIndex = entry.view.rowIndex;
  selection = clone(entry.view.selection);
  textEditGroup = null;
  normalizeSelection();
  persist();
  render();
}
function selectedPhotoNode() {
  return (
    selection &&
    $("canvas").children[selection.row]?.querySelectorAll(".canvas-photo")[
      selection.index
    ]
  );
}
function syncPhotoSelection() {
  [...$("canvas").children].forEach((row, r) => {
    row.classList.toggle("active", rowIndex === r);
    row.querySelectorAll(".canvas-photo").forEach((tile, index) => {
      const active = selection?.row === r && selection?.index === index;
      tile.classList.toggle("selected", active);
      tile.setAttribute("aria-pressed", String(active));
    });
  });
  renderLibraryHint();
}
function selectPhoto(r, index, inspect = true) {
  rowIndex = r;
  selection = index === null ? null : { row: r, index };
  syncPhotoSelection();
  if (inspect) renderInspector();
}
function clearDropMarker() {
  $("canvas")
    .querySelectorAll(".photo-drop-marker")
    .forEach((node) => node.remove());
  document
    .querySelectorAll(".drop-target")
    .forEach((node) => node.classList.remove("drop-target"));
}
function endPhotoDrag(inspect = true) {
  const wasDragging = !!photoDrag;
  photoDrag = null;
  if (dragFrame !== null) cancelAnimationFrame(dragFrame);
  dragFrame = null;
  clearDropMarker();
  document
    .querySelectorAll(".drag-source")
    .forEach((node) => node.classList.remove("drag-source"));
  document.body.classList.remove("photo-dragging");
  if (wasDragging && inspect && catalog) renderInspector();
}
function drag(event, payload) {
  if (preview || saving) return event.preventDefault();
  event.dataTransfer.setData(
    "application/x-page-studio",
    JSON.stringify(payload),
  );
  event.dataTransfer.effectAllowed =
    payload.kind === "library" ? "copy" : "move";
  if (!["photo", "library"].includes(payload.kind)) return;
  endPhotoDrag(false);
  photoDrag = {
    payload,
    source:
      payload.kind === "photo"
        ? page()?.rows[payload.from.row]?.[payload.from.index]
        : null,
  };
  if (payload.kind === "photo")
    selectPhoto(payload.from.row, payload.from.index, false);
  event.currentTarget.classList.add("drag-source");
  document.body.classList.add("photo-dragging");
}
function rowInsertion(row, x) {
  const bounds = [...row.querySelectorAll(".canvas-photo")].map((tile) =>
    tile.getBoundingClientRect(),
  );
  return { bounds, index: photoInsertionIndex(bounds, x) };
}
function markRowDrop(row, x) {
  clearDropMarker();
  if (!canDropInRow(row)) return;
  const { bounds, index } = rowInsertion(row, x);
  row.classList.add("drop-target");
  if (bounds.length) {
    const rect = row.getBoundingClientRect();
    const left =
      index === 0
        ? bounds[0].left
        : index === bounds.length
          ? bounds.at(-1).right
          : (bounds[index - 1].right + bounds[index].left) / 2;
    row.append(
      h("span", {
        className: "photo-drop-marker",
        "aria-hidden": "true",
        style: { left: `${left - rect.left}px` },
      }),
    );
  }
}
function canDropInRow(row) {
  const r = [...$("canvas").children].indexOf(row);
  const from = photoDrag?.payload.from;
  return (
    page()?.rows[r]?.length < 12 ||
    (from?.pageId === page()?.id && from.row === r)
  );
}
function trackDragPointer(event) {
  if (!photoDrag) return;
  photoDrag.x = event.clientX;
  photoDrag.y = event.clientY;
  if (dragFrame === null) dragFrame = requestAnimationFrame(autoScrollDrag);
}
function autoScrollDrag() {
  dragFrame = null;
  if (!photoDrag || !Number.isFinite(photoDrag.y)) return;
  const viewport = document.querySelector(".canvas-scroll"),
    rect = viewport.getBoundingClientRect();
  const { x, y } = photoDrag;
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
    return;
  const delta =
    y < rect.top + 40
      ? -Math.ceil((rect.top + 40 - y) / 4)
      : y > rect.bottom - 40
        ? Math.ceil((y - rect.bottom + 40) / 4)
        : 0;
  const previous = viewport.scrollTop;
  viewport.scrollTop = Math.max(
    0,
    Math.min(viewport.scrollHeight - viewport.clientHeight, previous + delta),
  );
  if (viewport.scrollTop !== previous) {
    const row = document.elementFromPoint?.(x, y)?.closest(".photo-row");
    if (row && $("canvas").contains(row)) markRowDrop(row, x);
    dragFrame = requestAnimationFrame(autoScrollDrag);
  }
}
function hoverPhotoDrop(event, row) {
  if (!photoDrag || preview || saving) return;
  event.stopPropagation();
  trackDragPointer(event);
  if (!canDropInRow(row)) {
    event.dataTransfer.dropEffect = "none";
    clearDropMarker();
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect =
    photoDrag.payload.kind === "library" ? "copy" : "move";
  markRowDrop(row, event.clientX);
}
function focusMovedPhoto(result) {
  if (!result) return;
  selectedPhotoNode()?.focus({ preventScroll: true });
  $("photo-move-status").textContent = `Moved to ${page().title}, row ${
    result.row + 1
  }, position ${result.index + 1}.`;
}
function applyPhotoMove(from, to) {
  let result = null;
  update((draft) => {
    result = movePhoto(draft, from, to);
    if (!result) return;
    if (!pages().some((p) => p.id === result.pageId)) galleryIndex = -1;
    pageIndex = pages().findIndex((p) => p.id === result.pageId);
    rowIndex = result.row;
    selection = { row: result.row, index: result.index };
  });
  focusMovedPhoto(result);
  return result;
}
function drop(event, targetRow, targetIndex, newRow = false) {
  event.preventDefault();
  event.stopPropagation();
  if (!photoDrag || preview || saving) return;
  const { payload, source } = photoDrag;
  endPhotoDrag(false);
  if (payload.kind === "library")
    return addPhoto(payload.key, targetRow, targetIndex, { newRow });
  const current = catalog.pages.find((p) => p.id === payload.from.pageId)?.rows[
    payload.from.row
  ]?.[payload.from.index];
  if (current !== source)
    return notify("That photo changed during the drag. Pick it up again.");
  const result = applyPhotoMove(payload.from, {
    pageId: page().id,
    row: targetRow,
    index: targetIndex,
    newRow,
  });
  if (!result)
    notify(
      "That destination is full or no longer available. Choose another row.",
    );
}
function addPhoto(
  key,
  targetRow = rowIndex,
  targetIndex,
  { newRow = false } = {},
) {
  if (preview || saving) return;
  if (workspaceView === "box") {
    boxStudio.add([key]);
    return;
  }
  const item = library.find((item) => item.key === key);
  if (!item) return;
  if (!page() && catalog.pages.length >= 600)
    return notify("The page limit has been reached.");
  if (newRow && (page()?.rows.length || 0) >= 12)
    return notify("A page can hold at most 12 rows.");
  if (!newRow && page()?.rows[targetRow]?.length >= 12)
    return notify("A row can hold up to 12 photos. Add another row.");
  update(() => {
    if (!page()) {
      createPage();
    }
    if (newRow) {
      targetRow = page().rows.length;
      page().rows.push([]);
    } else if (!page().rows.length) page().rows.push([]);
    targetRow = Math.max(0, Math.min(targetRow, page().rows.length - 1));
    const row = page().rows[targetRow];
    const index = Math.max(0, Math.min(targetIndex ?? row.length, row.length));
    row.splice(index, 0, clone(item.photo));
    rowIndex = targetRow;
    selection = { row: targetRow, index };
  });
  if ($("library-dialog").open) $("library-dialog").close();
  selectedPhotoNode()?.focus({ preventScroll: true });
}
function addPage() {
  if (
    catalog.pages.length >= 600 ||
    (gallery() && gallery().pageIds.length >= 200)
  )
    return notify("The page limit has been reached.");
  update(() => {
    createPage();
    workspaceView = "edit";
  });
  closePages();
}
function openPhoto(photo) {
  $("large-photo").src = photoUrl(photo.yearFilename);
  $("large-photo").alt = photo.title;
  $("large-photo-title").textContent = photo.title;
  $("photo-dialog").showModal();
}
function renderPages() {
  organizer.renderNav();
  $("gallery-tools").hidden = !gallery();
  $("edit-gallery").hidden = !gallery();
  $("add-existing").hidden = !gallery();
  $("section-name").textContent = gallery()
    ? "In this gallery"
    : "Page library";
  $("page-count").textContent = pages().length;
  $("gallery-note").textContent = gallery()
    ? "Drag galleries or use the arrows to change menu order."
    : "Every page lives here, including pages used in several galleries.";
  if (gallery()) {
    $("gallery-up").disabled = galleryIndex === 0;
    $("gallery-down").disabled = galleryIndex === catalog.galleries.length - 1;
  }
  $("pages").replaceChildren(
    ...pages().map((p, i) => {
      const miniature = h(
        "div",
        { className: "mini-page" },
        ...p.rows.map((row) =>
          h(
            "div",
            { className: "mini-row" },
            ...row.map((photo) =>
              h("img", {
                src: thumb(photo.yearFilename),
                alt: "",
                loading: "lazy",
              }),
            ),
          ),
        ),
      );
      if (!p.rows.some((row) => row.length))
        miniature.append(h("span", { className: "blank-label" }, "Blank page"));
      const choose = button(
        "",
        () => {
          workspaceView = "edit";
          pageIndex = i;
          rowIndex = 0;
          selection = null;
          render();
          closePages();
        },
        {
          className: "page-select",
          "aria-label": `Edit ${p.title}`,
          draggable: !preview,
          ondragstart: (e) =>
            drag(e, { kind: "page", gallery: galleryIndex, index: i }),
        },
      );
      choose.append(miniature);
      const controls = h(
        "div",
        { className: "page-controls" },
        button(
          "↑",
          () =>
            update(() => {
              pageIndex = moveItem(pageOrder(), i, -1);
              selection = null;
            }),
          {
            disabled: i === 0,
            title: "Move page earlier",
            "aria-label": `Move ${p.title} earlier`,
          },
        ),
        button(
          "↓",
          () =>
            update(() => {
              pageIndex = moveItem(pageOrder(), i, 1);
              selection = null;
            }),
          {
            disabled: i === pages().length - 1,
            title: "Move page later",
            "aria-label": `Move ${p.title} later`,
          },
        ),
        button(
          p.visible ? "Hide" : "Show",
          () =>
            update(() => {
              p.visible = !p.visible;
            }),
          {
            title: "Changes visibility in every gallery",
            "aria-label": `${p.visible ? "Hide" : "Show"} ${
              p.title
            } everywhere`,
          },
        ),
      );
      const usage = galleriesForPage(catalog, p.id);
      return h(
        "div",
        {
          className:
            "page-item" +
            (i === pageIndex ? " active" : "") +
            (!p.visible ? " hidden-page" : ""),
          "data-page-id": p.id,
          ondragover: (e) => e.preventDefault(),
          ondrop: (e) => {
            e.preventDefault();
            try {
              const payload = JSON.parse(
                e.dataTransfer.getData("application/x-page-studio"),
              );
              if (payload.kind === "page" && payload.gallery === galleryIndex)
                update(() => {
                  pageIndex = moveItem(
                    pageOrder(),
                    payload.index,
                    i - payload.index,
                  );
                  selection = null;
                });
            } catch {
              /* Ignore external drags. */
            }
          },
        },
        choose,
        h(
          "div",
          { className: "page-caption" },
          h("span", { className: "page-name" }, p.title),
          controls,
        ),
        h(
          "p",
          { className: "page-usage" },
          (p.visible ? "Visible · " : "Hidden · ") +
            (usage.length
              ? `${usage.length} ${
                  usage.length === 1 ? "gallery" : "galleries"
                }`
              : "Not in a gallery"),
        ),
      );
    }),
  );
}
function fitCanvas() {
  const viewport = document.querySelector(".canvas-scroll");
  const style = getComputedStyle(viewport);
  const availableWidth =
    viewport.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  const availableHeight =
    viewport.clientHeight -
    parseFloat(style.paddingTop) -
    parseFloat(style.paddingBottom) -
    (preview || !page()
      ? 0
      : $("add-row").getBoundingClientRect().height +
        parseFloat(getComputedStyle($("add-row")).marginTop));
  const width =
    $("zoom").value === "large"
      ? Math.min(590, availableWidth)
      : Math.max(100, Math.min(590, availableWidth, availableHeight * 0.85));
  $("canvas").style.width = width + "px";
  $("canvas").style.minHeight = "0";
  $("canvas").style.padding = `${width * 0.1}px ${width * 0.06}px`;
  $("canvas").style.gap = `${Math.max(4, width * 0.02)}px`;
  $("add-row").style.width =
    Math.min(availableWidth, Math.max(150, width)) + "px";
}
function renderCanvas() {
  $("page-title").textContent =
    page()?.title || gallery()?.title || "Page library";
  $("page-settings").hidden = !page();
  if (page()) {
    $("page-name").value = page().title;
    organizer.renderPageSettings();
  }
  $("delete-page").textContent = gallery()
    ? "Remove from gallery"
    : "Delete page";
  $("delete-page").title = gallery()
    ? "Keep this page in the library; remove only this gallery link"
    : "Delete this page from the library and every gallery (undo available)";
  $("page-description").textContent = preview
    ? dirty()
      ? "Previewing your unsaved draft"
      : "Previewing saved pages"
    : "Drag photos to the insertion line, or use Option/Alt + arrow keys.";
  $("workspace").classList.toggle("is-preview", preview);
  $("preview").textContent = preview ? "Back to editing" : "Preview";
  $("canvas").hidden = !page();
  $("empty-page").hidden = !!page();
  $("add-row").hidden = !page();
  $("add-row").disabled = (page()?.rows.length || 0) >= 12;
  $("duplicate-page").disabled = !page() || preview;
  $("delete-page").disabled = !page() || preview;
  $("canvas").replaceChildren(
    ...(page()?.rows || []).map((row, r) => {
      const node = h("div", {
        className: "photo-row" + (rowIndex === r ? " active" : ""),
        onclick: () => {
          if (!preview && !saving) selectPhoto(r, null);
        },
        ondragenter: (e) => hoverPhotoDrop(e, node),
        ondragover: (e) => hoverPhotoDrop(e, node),
        ondragleave: (e) => {
          if (!node.contains(e.relatedTarget)) clearDropMarker();
        },
        ondrop: (e) => drop(e, r, rowInsertion(node, e.clientX).index),
      });
      node.append(h("span", { className: "row-label" }, `ROW ${r + 1}`));
      node.append(
        h(
          "div",
          { className: "row-tools" },
          button(
            "↑",
            (e) => {
              e.stopPropagation();
              update(() => {
                rowIndex = moveItem(page().rows, r, -1);
                selection = null;
              });
            },
            {
              disabled: r === 0,
              title: "Move row up",
              "aria-label": `Move row ${r + 1} up`,
            },
          ),
          button(
            "↓",
            (e) => {
              e.stopPropagation();
              update(() => {
                rowIndex = moveItem(page().rows, r, 1);
                selection = null;
              });
            },
            {
              disabled: r === page().rows.length - 1,
              title: "Move row down",
              "aria-label": `Move row ${r + 1} down`,
            },
          ),
          button(
            "×",
            (e) => {
              e.stopPropagation();
              update(() => {
                page().rows.splice(r, 1);
                selection = null;
              });
            },
            {
              title: "Remove row (undo available)",
              "aria-label": `Remove row ${r + 1}`,
            },
          ),
        ),
      );
      if (!row.length)
        node.append(
          h(
            "div",
            { className: "empty-row" },
            "Drop photos here, or use + in the library",
          ),
        );
      row.forEach((photo, index) => {
        const selected = selection?.row === r && selection?.index === index;
        const imageButton = button(
          "",
          (e) => {
            e.stopPropagation();
            if (preview) return openPhoto(photo);
            selectPhoto(r, index);
          },
          {
            className: "canvas-photo" + (selected ? " selected" : ""),
            draggable: !preview && !saving,
            "aria-pressed": String(selected),
            "aria-label": `Select ${photo.title || photo.yearFilename}`,
            "data-order": index + 1,
            style: {
              flex: `${
                { horizontal: 15, vertical: 7, square: 10 }[
                  photo.aspect || "horizontal"
                ]
              } 1 0`,
            },
            ondragstart: (e) =>
              drag(e, {
                kind: "photo",
                from: {
                  pageId: page().id,
                  row: r,
                  index,
                  key: photo.yearFilename,
                },
              }),
            onkeydown: (e) => nudgePhoto(e, r, index),
          },
        );
        imageButton.append(
          h("img", {
            src: photoUrl(photo.yearFilename),
            alt: photo.title,
            draggable: false,
          }),
        );
        node.append(imageButton);
      });
      return node;
    }),
  );
  $("counts").textContent = `${pages().length} pages · ${photoCount(
    pages(),
  )} photos ${gallery() ? "in this gallery" : "in the page library"}`;
  const savedGallery = visibleGalleries(saved).find((g) =>
    gallery() ? g.id === gallery().id : g.pageIds.includes(page()?.id),
  );
  $("local-preview").href = savedGallery
    ? "/preview#/" + savedGallery.slug
    : "/preview";
  $("saved-preview").hidden = !savedGallery;
  if (savedGallery) $("saved-preview").href = "/preview#/" + savedGallery.slug;
  renderLibraryHint();
}

function renderFolderFilter() {
  const previous = $("folder").value;
  const available = library.filter(
    (item) => !$("year").value || item.year === $("year").value,
  );
  const groups = [
    ...new Set(
      available
        .filter((item) => item.group)
        .map((item) => item.year + "/" + item.group),
    ),
  ].sort();
  $("folder").replaceChildren(
    h("option", { value: "" }, "All folders"),
    ...(available.some((item) => !item.group)
      ? [h("option", { value: "ungrouped" }, "Ungrouped photos")]
      : []),
    ...groups.map((group) =>
      h("option", { value: group }, group.replaceAll("/", " / ")),
    ),
  );
  $("folder").value = [...$("folder").options].some(
    (option) => option.value === previous,
  )
    ? previous
    : "";
}
function libraryUsed() {
  return new Set(
    workspaceView === "box"
      ? catalog.boxPhotos
      : pages().flatMap((p) =>
          p.rows.flatMap((row) => row.map((photo) => photo.yearFilename)),
        ),
  );
}
function filteredLibrary() {
  const used = libraryUsed();
  const query = $("search").value.toLowerCase().trim();
  return library.filter(
    (item) =>
      (!$("year").value || item.year === $("year").value) &&
      (!$("folder").value ||
        ($("folder").value === "ungrouped"
          ? !item.group
          : item.year + "/" + item.group === $("folder").value)) &&
      (!$("unused").checked || !used.has(item.key)) &&
      (!query ||
        `${item.key} ${item.photo.title} ${item.photo.location}`
          .toLowerCase()
          .includes(query)),
  );
}
function renderLibrary() {
  const scroll = $("library").scrollTop;
  $("unused-label").textContent =
    workspaceView === "box" ? "Not in box" : "Unused here";
  renderFolderFilter();
  const used = libraryUsed(),
    visible = filteredLibrary();
  $("library-count").textContent = `${visible.length} / ${library.length}`;
  $("library").replaceChildren(
    ...visible.map((item) => {
      const imageButton = button("", () => openPhoto(item.photo), {
        className: "library-open",
        "aria-label": `Preview ${item.photo.title}`,
      });
      imageButton.append(
        h("img", {
          src: thumb(item.key),
          alt: item.photo.title,
          loading: "lazy",
          className: "library-image",
          draggable: false,
        }),
      );
      return h(
        "div",
        {
          className: "library-card",
          draggable: true,
          ondragstart: (e) => drag(e, { kind: "library", key: item.key }),
        },
        h(
          "div",
          { className: "library-visual" },
          imageButton,
          used.has(item.key)
            ? h(
                "span",
                { className: "used" },
                workspaceView === "box"
                  ? "In box"
                  : gallery()
                    ? "In gallery"
                    : "On a page",
              )
            : null,
          button(
            workspaceView === "box" && used.has(item.key) ? "✓" : "+",
            () => addPhoto(item.key),
            {
              className:
                "library-add" +
                (workspaceView === "box" && used.has(item.key)
                  ? " in-box"
                  : ""),
              disabled:
                preview || (workspaceView === "box" && used.has(item.key)),
              title:
                workspaceView === "box"
                  ? used.has(item.key)
                    ? "Already in box"
                    : "Add to box"
                  : `Add to row ${rowIndex + 1}`,
              "aria-label":
                workspaceView === "box"
                  ? `${
                      used.has(item.key) ? "Already in box:" : "Add to box:"
                    } ${item.key}`
                  : `Add ${item.key} to selected row`,
            },
          ),
        ),
        h(
          "p",
          { className: "file-name", title: item.key },
          item.filename.replace(/\.webp$/i, ""),
        ),
        h(
          "p",
          { className: "file-context", title: item.key },
          item.group ? item.year + " / " + item.group : item.year,
        ),
      );
    }),
  );
  if (!visible.length)
    $("library").append(
      h(
        "p",
        { className: "library-hint", style: { gridColumn: "1 / -1" } },
        "No photos match these filters.",
      ),
    );
  $("library").scrollTop = scroll;
  renderLibraryHint();
  boxStudio.updateFilters();
}
function renderLibraryHint() {
  $("library")
    .querySelectorAll(".library-add")
    .forEach((button) => {
      if (workspaceView !== "box") button.title = `Add to row ${rowIndex + 1}`;
    });
  $("library-hint").textContent =
    workspaceView === "box"
      ? "Add with + or drag a photo into the box order."
      : preview
        ? "Open a photo to see it larger."
        : page()
          ? `Add photos to ${page().title || "Untitled page"} · Row ${
              rowIndex + 1
            }.`
          : "Use + to start a new hidden page.";
}
function nudgePhoto(event, r, index) {
  if (
    !event.altKey ||
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) ||
    preview ||
    saving
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  const targetRow =
    r + (event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0);
  if (!page().rows[targetRow]) return;
  const targetIndex =
    event.key === "ArrowLeft"
      ? index - 1
      : event.key === "ArrowRight"
        ? index + 2
        : Math.min(index, page().rows[targetRow].length);
  if (targetIndex < 0 || targetIndex > page().rows[targetRow].length) return;
  selectPhoto(r, index, false);
  const result = applyPhotoMove(
    { pageId: page().id, row: r, index },
    { pageId: page().id, row: targetRow, index: targetIndex },
  );
  if (!result) notify("That row is full. Choose another row.");
}
function openMovePhoto() {
  if (preview || saving || !selection) return;
  const photo = page()?.rows[selection.row]?.[selection.index];
  if (!photo) return;
  moveSource = {
    from: { pageId: page().id, ...selection, key: photo.yearFilename },
    photo,
  };
  $("move-photo-description").textContent = `${
    photo.title || photo.yearFilename
  } · From ${page().title}, row ${selection.row + 1}`;
  $("move-photo-error").textContent = "";
  $("move-photo-page").replaceChildren(
    ...catalog.pages.map((p) =>
      h(
        "option",
        { value: p.id, selected: p.id === page().id },
        p.title + (p.visible ? "" : " · Hidden"),
      ),
    ),
  );
  renderMoveRows();
  $("move-photo-dialog").showModal();
}
function renderMoveRows() {
  if (!moveSource) return;
  const target = catalog.pages.find((p) => p.id === $("move-photo-page").value);
  if (!target) return;
  const samePage = target.id === moveSource.from.pageId;
  const preferred = samePage
    ? moveSource.from.row
    : target.rows.findIndex((row) => row.length < 12);
  $("move-photo-row").replaceChildren(
    ...target.rows.map((row, i) =>
      h(
        "option",
        {
          value: i,
          selected: i === preferred,
          disabled:
            row.length >= 12 && !(samePage && moveSource.from.row === i),
        },
        `Row ${i + 1} · ${row.length} ${row.length === 1 ? "photo" : "photos"}${
          row.length >= 12 ? " · full" : ""
        }`,
      ),
    ),
    ...(target.rows.length < 12
      ? [
          h(
            "option",
            { value: "new", selected: preferred < 0 || !target.rows.length },
            "New row at the end",
          ),
        ]
      : []),
  );
  renderMovePositions();
}
function renderMovePositions() {
  if (!moveSource) return;
  const target = catalog.pages.find((p) => p.id === $("move-photo-page").value);
  const newRow = $("move-photo-row").value === "new";
  const r = newRow ? target.rows.length : Number($("move-photo-row").value);
  const sameRow =
    !newRow &&
    target.id === moveSource.from.pageId &&
    r === moveSource.from.row;
  const row = newRow ? [] : target.rows[r] || [];
  const remaining = row.filter(
    (_, i) => !sameRow || i !== moveSource.from.index,
  );
  $("move-photo-position").replaceChildren(
    ...Array.from({ length: remaining.length + 1 }, (_, i) =>
      h(
        "option",
        {
          value: i,
          selected: i === (sameRow ? moveSource.from.index : remaining.length),
        },
        `${i + 1} · ${
          !remaining.length
            ? "Only photo"
            : i === remaining.length
              ? "At the end"
              : "Before " + (remaining[i].title || remaining[i].yearFilename)
        }`,
      ),
    ),
  );
  const shared = [moveSource.from.pageId, target.id].some(
    (id) => galleriesForPage(catalog, id).length > 1,
  );
  $("move-photo-note").textContent =
    "Moves the existing photo. Page memberships stay the same." +
    (shared ? " Edits to shared pages apply in all their galleries." : "");
  renderMoveSubmit();
}
function renderMoveSubmit() {
  const same =
    $("move-photo-page").value === moveSource?.from.pageId &&
    $("move-photo-row").value !== "new" &&
    Number($("move-photo-row").value) === moveSource?.from.row &&
    Number($("move-photo-position").value) === moveSource?.from.index;
  const available = $("move-photo-row").selectedOptions[0];
  $("move-photo-submit").disabled = !available || available.disabled || same;
}
$("move-photo-page").onchange = renderMoveRows;
$("move-photo-row").onchange = renderMovePositions;
$("move-photo-position").onchange = renderMoveSubmit;
$("move-photo-cancel").onclick = () => $("move-photo-dialog").close();
$("move-photo-dialog").addEventListener("close", () => {
  moveSource = null;
});
$("move-photo-form").onsubmit = (event) => {
  event.preventDefault();
  if (!moveSource || preview || saving || $("move-photo-submit").disabled)
    return;
  const { from, photo } = moveSource;
  if (
    catalog.pages.find((p) => p.id === from.pageId)?.rows[from.row]?.[
      from.index
    ] !== photo
  ) {
    $("move-photo-error").textContent =
      "The source photo changed. Cancel and select it again.";
    return;
  }
  const target = catalog.pages.find((p) => p.id === $("move-photo-page").value);
  const newRow = $("move-photo-row").value === "new";
  const r = newRow ? target.rows.length : Number($("move-photo-row").value);
  let index = Number($("move-photo-position").value);
  if (
    !newRow &&
    target.id === from.pageId &&
    r === from.row &&
    index > from.index
  )
    index++;
  const result = applyPhotoMove(from, {
    pageId: target.id,
    row: r,
    index,
    newRow,
  });
  if (!result) {
    $("move-photo-error").textContent =
      "That destination is full or unavailable. Choose another row.";
    return;
  }
  $("move-photo-dialog").close();
  focusMovedPhoto(result);
};
function renderInspector() {
  const photo = selection && page()?.rows[selection.row]?.[selection.index];
  if (!photo) {
    $("inspector").replaceChildren(
      h("p", {}, "Select a photo on the page to edit its details or move it."),
    );
    return;
  }
  const { row: r, index } = selection;
  const change = (key, value, text = false) => {
    update(
      () => {
        page().rows[r][index][key] = value;
      },
      text
        ? { group: `${page().id}:${r}:${index}:${key}`, refresh: false }
        : {},
    );
    if (text && key === "title") {
      const tile =
        $("canvas").children[r]?.querySelectorAll(".canvas-photo")[index];
      if (tile) {
        tile.setAttribute(
          "aria-label",
          "Select " + (value || photo.yearFilename),
        );
        tile.querySelector("img").alt = value;
      }
    }
  };
  const field = (label, key, limit) =>
    h(
      "label",
      {},
      label,
      h("input", {
        value: photo[key],
        maxLength: limit,
        oninput: (e) => change(key, e.target.value, true),
        onblur: () => {
          textEditGroup = null;
        },
      }),
    );
  const orientation = h(
    "select",
    {
      "aria-label": "Photo orientation",
      onchange: (e) => change("aspect", e.target.value),
    },
    ...["horizontal", "vertical", "square"].map((value) =>
      h(
        "option",
        { value, selected: value === (photo.aspect || "horizontal") },
        value[0].toUpperCase() + value.slice(1),
      ),
    ),
  );
  const actions = h(
    "div",
    { className: "inspector-actions" },
    button(
      "←",
      () =>
        applyPhotoMove(
          { pageId: page().id, row: r, index },
          { pageId: page().id, row: r, index: index - 1 },
        ),
      { disabled: index === 0, "aria-label": "Move photo left" },
    ),
    button(
      "→",
      () =>
        applyPhotoMove(
          { pageId: page().id, row: r, index },
          { pageId: page().id, row: r, index: index + 2 },
        ),
      {
        disabled: index === page().rows[r].length - 1,
        "aria-label": "Move photo right",
      },
    ),
    button("Move photo…", openMovePhoto, { disabled: preview || saving }),
    button(
      "Remove",
      () =>
        update(() => {
          page().rows[r].splice(index, 1);
          selection = null;
        }),
      { className: "quiet-danger" },
    ),
  );
  $("inspector").replaceChildren(
    h(
      "div",
      { className: "inspector-title" },
      h(
        "span",
        { title: photo.yearFilename },
        photo.yearFilename.split("/").at(-1),
      ),
      actions,
    ),
    h(
      "details",
      {
        className: "photo-details",
        open: detailsOpen,
        ontoggle: (e) => {
          if (e.target.isConnected) {
            detailsOpen = e.target.open;
            fitCanvas();
          }
        },
      },
      h("summary", {}, "Photo details"),
      h(
        "div",
        { className: "inspector-fields" },
        field("Title / alt text", "title", 200),
        field("Location", "location", 200),
        field("Date", "date", 100),
        h("label", {}, "Orientation", orientation),
      ),
    ),
  );
}
function render() {
  if (photoDrag) endPhotoDrag(false);
  boxStudio.clearDrag();
  document.body.classList.toggle("boxing", workspaceView === "box");
  pagesPanel.hidden = workspaceView === "box";
  $("box-studio").hidden = workspaceView !== "box";
  document.body.classList.toggle("organizing", workspaceView === "organize");
  $("organizer").hidden = workspaceView !== "organize";
  document.querySelector(".canvas-panel").hidden = workspaceView !== "edit";
  libraryPanel.hidden = workspaceView === "organize";
  $("editor-pages").hidden = workspaceView === "organize";
  if (panelView !== workspaceView) syncPanels();
  renderPages();
  organizer.render();
  renderCanvas();
  renderLibrary();
  renderInspector();
  boxStudio.render();
  if (workspaceView === "box") $("local-preview").href = "/preview#/";
  fitCanvas();
  for (const id of [
    "new-gallery",
    "edit-gallery",
    "page-galleries",
    "page-name",
    "add-page",
    "add-existing",
    "empty-add-page",
  ])
    $(id).disabled = saving || preview;
  if (preview) {
    $("gallery-up").disabled = true;
    $("gallery-down").disabled = true;
  }
  document.body.classList.toggle("preview-mode", preview);
  renderStatus();
}
function renderStatus() {
  $("undo").disabled = saving || preview || !undo.length;
  $("redo").disabled = saving || preview || !redo.length;
  $("save").disabled = saving || !dirty();
  $("box-view").disabled = !catalog || saving;
  $("box-view").setAttribute("aria-pressed", String(workspaceView === "box"));
  $("organize-view").disabled = !catalog || saving;
  $("edit-view").disabled = !page() || saving;
  $("organize-view").setAttribute(
    "aria-pressed",
    String(workspaceView === "organize"),
  );
  $("edit-view").setAttribute("aria-pressed", String(workspaceView === "edit"));
  $("show-pages").textContent =
    workspaceView === "organize" ? "Galleries" : "Pages";
  $("show-pages").disabled = !catalog || saving;
  $("show-library").disabled = !catalog || saving;
  $("status").textContent = saving
    ? "Preparing photos and saving…"
    : dirty()
      ? "Unsaved draft"
      : "Saved locally";
}
async function request(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}
async function save() {
  if (saving || !dirty()) return;
  saving = true;
  $("workspace").inert = true;
  render();
  notify();
  try {
    const { boxPhotos, ...pageCatalog } = catalog;
    const result = await request("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Page-Studio": "1" },
      body: JSON.stringify({
        catalog: pageCatalog,
        revision,
        boxKeys: boxPhotos,
        boxRevision,
      }),
    });
    notify(
      result.warning ||
        "Saved locally. Open or refresh the local preview to see your changes. Publishing is separate.",
    );
    saved = { ...clone(result.catalog), boxPhotos: result.box.keys };
    catalog = clone(saved);
    revision = result.revision;
    boxRevision = result.box.revision;
    persist();
    $("recovery").hidden = true;
    $("status").textContent = "Saved locally";
  } catch (error) {
    notify(error.message);
  } finally {
    saving = false;
    $("workspace").inert = false;
    render();
  }
}
function openGalleryDialog(mode) {
  if (preview || saving) return;
  if (mode === "new" && catalog.galleries.length >= 30)
    return notify("The limit of 30 galleries has been reached.");
  dialogMode = mode;
  $("dialog-title").textContent =
    mode === "new" ? "New gallery" : "Edit gallery";
  $("gallery-name").value = mode === "new" ? "" : gallery().title;
  $("gallery-slug").value = mode === "new" ? "" : gallery().slug;
  $("dialog-error").textContent = "";
  $("dialog-gallery-visible").value = String(
    mode === "new" ? false : gallery().visible,
  );
  $("gallery-dialog").showModal();
}
$("gallery-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("gallery-name").value.trim(),
    slug = $("gallery-slug").value.trim();
  if (
    !title ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    ["old", "studio", "preview", "about"].includes(slug) ||
    catalog.galleries.some(
      (g, i) => g.slug === slug && (dialogMode === "new" || i !== galleryIndex),
    )
  ) {
    $("dialog-error").textContent =
      "Use a unique address with lowercase letters, numbers, and hyphens.";
    return;
  }
  update(() => {
    if (dialogMode === "new") {
      let id = slug;
      while (catalog.galleries.some((g) => g.id === id)) id += "-new";
      catalog.galleries.push({
        id,
        title,
        slug,
        visible: $("dialog-gallery-visible").value === "true",
        pageIds: [],
      });
      workspaceView = "organize";
      organizer.clearSelection();
      galleryIndex = catalog.galleries.length - 1;
      pageIndex = 0;
      rowIndex = 0;
      selection = null;
    } else {
      gallery().title = title;
      gallery().slug = slug;
      gallery().visible = $("dialog-gallery-visible").value === "true";
    }
  });
  $("gallery-dialog").close();
  closePages();
});
$("gallery-name").addEventListener("input", (e) => {
  if (dialogMode === "new") $("gallery-slug").value = slugify(e.target.value);
});
$("cancel-gallery").onclick = () => $("gallery-dialog").close();
$("close-photo").onclick = () => $("photo-dialog").close();
$("photo-dialog").addEventListener("close", () =>
  $("large-photo").removeAttribute("src"),
);
$("new-gallery").onclick = () => openGalleryDialog("new");
$("edit-gallery").onclick = () => openGalleryDialog("edit");
$("add-page").onclick = addPage;
$("empty-add-page").onclick = addPage;
$("duplicate-page").onclick = () => {
  if (
    catalog.pages.length >= 600 ||
    (gallery() && gallery().pageIds.length >= 200)
  )
    return notify("The page limit has been reached.");
  update(() => createPage(page()));
};
$("delete-page").onclick = () =>
  update(() => {
    const id = page().id;
    if (gallery()) detachPage(catalog, gallery().id, id);
    else deletePage(catalog, id);
    selection = null;
  });
$("gallery-up").onclick = () =>
  organizer.moveGallery(gallery().id, catalog.galleries[galleryIndex - 1]?.id);
$("gallery-down").onclick = () =>
  organizer.moveGallery(gallery().id, catalog.galleries[galleryIndex + 1]?.id);
$("page-galleries").onclick = () => organizer.openMembership([page().id]);
$("page-name").oninput = (e) => {
  const title = e.target.value;
  update(
    () => {
      page().title = title;
    },
    { group: page().id + ":title", refresh: false },
  );
  renderPageTitle();
};
$("page-name").onchange = (e) => {
  const title = e.target.value.trim() || "Untitled page";
  update(
    () => {
      page().title = title;
    },
    { group: page().id + ":title", refresh: false },
  );
  e.target.value = title;
  renderPageTitle();
};
function renderPageTitle() {
  $("page-title").textContent = page().title || "Untitled page";
  const item = [...document.querySelectorAll(".page-item")].find(
    (item) => item.dataset.pageId === page().id,
  );
  if (item) {
    item.querySelector(".page-name").textContent =
      page().title || "Untitled page";
    item
      .querySelector(".page-select")
      .setAttribute("aria-label", "Edit " + page().title);
    const controls = item.querySelectorAll(".page-controls button");
    controls[0].setAttribute("aria-label", `Move ${page().title} earlier`);
    controls[1].setAttribute("aria-label", `Move ${page().title} later`);
    controls[2].setAttribute(
      "aria-label",
      `${page().visible ? "Hide" : "Show"} ${page().title} everywhere`,
    );
  }
  renderLibraryHint();
}
$("page-name").onblur = () => {
  textEditGroup = null;
};
$("add-existing").onclick = () => {
  const candidates = catalog.pages.filter(
    (p) => !gallery().pageIds.includes(p.id),
  );
  $("attach-heading").textContent = "Add pages to " + gallery().title;
  $("attach-error").textContent = "";
  $("attach-list").replaceChildren(
    ...candidates.map((p) => {
      const first = p.rows.flat()[0];
      const uses = galleriesForPage(catalog, p.id).length;
      return h(
        "label",
        { className: "attach-card" },
        h("input", {
          type: "checkbox",
          value: p.id,
          name: "attach-page",
          onchange: renderAttachCount,
        }),
        first
          ? h("img", {
              src: thumb(first.yearFilename),
              alt: "",
              loading: "lazy",
            })
          : h("span", { className: "attach-blank" }, "Blank"),
        h(
          "span",
          {},
          h("strong", {}, p.title),
          h(
            "small",
            {},
            (p.visible ? "Visible" : "Hidden") +
              " · " +
              uses +
              (uses === 1 ? " gallery" : " galleries"),
          ),
        ),
      );
    }),
  );
  if (!candidates.length)
    $("attach-list").append(
      h("p", {}, "Every page in the library is already in this gallery."),
    );
  renderAttachCount();
  $("attach-dialog").showModal();
};
function renderAttachCount() {
  const count = document.querySelectorAll(
    'input[name="attach-page"]:checked',
  ).length;
  $("attach-submit").disabled = count === 0;
  $("attach-submit").textContent = count
    ? `Add ${count} ${count === 1 ? "page" : "pages"}`
    : "Add selected pages";
}
$("attach-cancel").onclick = () => $("attach-dialog").close();
$("attach-form").onsubmit = (e) => {
  e.preventDefault();
  const selected = [
    ...document.querySelectorAll('input[name="attach-page"]:checked'),
  ].map((input) => input.value);
  if (!selected.length) return;
  if (gallery().pageIds.length + selected.length > 200)
    return ($("attach-error").textContent =
      "A gallery can contain at most 200 pages.");
  update(() => {
    selected.forEach((id) => attachPage(catalog, gallery().id, id));
    pageIndex = gallery().pageIds.indexOf(selected[0]);
    selection = null;
  });
  $("attach-dialog").close();
};
$("add-row").onclick = () =>
  update(() => {
    page().rows.splice(rowIndex + 1, 0, []);
    rowIndex = Math.min(rowIndex + 1, page().rows.length - 1);
    selection = null;
  });
$("add-row").ondragenter = $("add-row").ondragover = (event) => {
  if (!photoDrag || preview || saving || $("add-row").disabled) return;
  event.preventDefault();
  event.stopPropagation();
  trackDragPointer(event);
  event.dataTransfer.dropEffect =
    photoDrag.payload.kind === "library" ? "copy" : "move";
  clearDropMarker();
  $("add-row").classList.add("drop-target");
};
$("add-row").ondragleave = () => $("add-row").classList.remove("drop-target");
$("add-row").ondrop = (event) => drop(event, page().rows.length, 0, true);
document
  .querySelector(".canvas-scroll")
  .addEventListener("dragover", (event) => {
    trackDragPointer(event);
    if (photoDrag) clearDropMarker();
  });
document.addEventListener("dragend", () => endPhotoDrag());
document.addEventListener("drop", () => endPhotoDrag());
window.addEventListener("blur", () => endPhotoDrag());
$("undo").onclick = () => history("undo");
$("redo").onclick = () => history("redo");
$("preview").onclick = () => {
  preview = !preview;
  render();
};
$("search").oninput = renderLibrary;
$("year").onchange = renderLibrary;
$("folder").onchange = renderLibrary;
$("unused").onchange = renderLibrary;
$("save").onclick = save;
$("export").onclick = () => {
  if (!catalog) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" }),
  );
  const link = h("a", { href: url, download: "photo-pages-draft.json" });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("restore").onclick = () => {
  if (!recovery || !draftIsValid(recovery.catalog)) return;
  preview = false;
  update(() => {
    catalog = clone(recovery.catalog);
  });
  if (recovery.boxRevision !== boxRevision) {
    boxRevision = recovery.boxRevision;
    notify(
      "The saved box changed since this draft. Export it before reloading; saving is blocked to protect newer edits.",
    );
  }
  if (recovery.revision !== revision) {
    revision = recovery.revision;
    notify(
      "The saved pages changed since this draft. Export it before reloading; saving is blocked to protect newer edits.",
    );
  }
  persist();
  $("recovery").hidden = true;
};
$("discard").onclick = () => {
  localStorage.removeItem(STORAGE);
  recovery = null;
  $("recovery").hidden = true;
};
window.addEventListener("beforeunload", (e) => {
  if (catalog && dirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("keydown", (e) => {
  if (!catalog || saving || document.querySelector("dialog[open]")) return;
  if (e.key === "Escape" && photoDrag) {
    endPhotoDrag();
    return;
  }
  if (e.key === "Escape" && preview) {
    preview = false;
    render();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    document.activeElement?.blur();
    save();
  }
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || ""))
    return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    history(e.shiftKey ? "redo" : "undo");
  }
});
async function initialize() {
  $("workspace").inert = true;
  try {
    const [data, photos, box] = await Promise.all([
      request("/api/catalog"),
      request("/api/library"),
      request("/api/box"),
    ]);
    data.catalog = migrateCatalog(data.catalog);
    if (!draftIsValid(data.catalog))
      throw new Error("The saved page catalog could not be read.");
    data.catalog.boxPhotos = box.keys;
    if (!draftIsValid(data.catalog))
      throw new Error("The saved photo box could not be read.");
    boxRevision = box.revision;
    catalog = clone(data.catalog);
    saved = clone(data.catalog);
    revision = data.revision;
    library = photos.photos;
    $("year").append(
      ...[...new Set(library.map((item) => item.year))]
        .sort()
        .reverse()
        .map((year) => h("option", { value: year }, year)),
    );
    try {
      recovery = JSON.parse(localStorage.getItem(STORAGE));
      if (recovery?.catalog) {
        recovery.catalog = migrateCatalog(recovery.catalog);
        // Old page-only recovery drafts keep the currently saved box.
        if (recovery.catalog.boxPhotos === undefined) {
          recovery.catalog.boxPhotos = clone(box.keys);
          recovery.boxRevision = box.revision;
        }
      }
    } catch {
      recovery = null;
    }
    if (
      draftIsValid(recovery?.catalog) &&
      JSON.stringify(recovery.catalog) !== JSON.stringify(catalog)
    )
      $("recovery").hidden = false;
    render();
    $("workspace").inert = false;
    $("workspace").setAttribute("aria-busy", "false");
  } catch (error) {
    notify(error.message);
    $("status").textContent = "Could not load pages. Reload to try again.";
  }
}
function navigateGallery(id, { refresh = true, keepMode = false } = {}) {
  const previous = page()?.id;
  galleryIndex = catalog.galleries.findIndex((g) => g.id === id);
  pageIndex = Math.max(
    0,
    pages().findIndex((p) => p.id === previous),
  );
  rowIndex = 0;
  selection = null;
  if (!keepMode) {
    workspaceView = "organize";
    preview = false;
    organizer.clearSelection();
  }
  if (refresh) {
    closePages();
    render();
    $("organizer").scrollTop = 0;
  }
}
function editPageById(id, { refresh = true, keepMode = false } = {}) {
  pageIndex = pages().findIndex((p) => p.id === id);
  if (pageIndex < 0) {
    galleryIndex = -1;
    pageIndex = pages().findIndex((p) => p.id === id);
  }
  rowIndex = 0;
  selection = null;
  if (!keepMode) {
    workspaceView = "edit";
    preview = false;
  }
  if (refresh) {
    closePages();
    render();
  }
}
const organizer = createOrganizer({
  h,
  button,
  thumb,
  read: () => ({
    catalog,
    saved,
    gallery: gallery(),
    page: page(),
    saving,
    preview,
    mode: workspaceView,
  }),
  update,
  notify,
  navigate: navigateGallery,
  editPage: editPageById,
  newPage: addPage,
  addExisting: () => $("add-existing").click(),
});
const boxStudio = createBoxStudio({
  h,
  button,
  thumb,
  update,
  notify,
  openPhoto,
  read: () => ({
    catalog,
    library,
    mode: workspaceView,
    saving,
    filtered: catalog ? filteredLibrary() : [],
  }),
  libraryDrag: () => photoDrag?.payload,
  endLibraryDrag: () => endPhotoDrag(false),
});
$("box-view").onclick = () => {
  workspaceView = "box";
  preview = false;
  render();
};
$("organize-view").onclick = () => {
  workspaceView = "organize";
  preview = false;
  render();
  $("organizer").scrollTop = 0;
};
$("edit-view").onclick = () => {
  workspaceView = "edit";
  preview = false;
  render();
};
$("zoom").onchange = fitCanvas;
const compactLayout = window.matchMedia("(max-width: 1100px)");
const phoneLayout = window.matchMedia("(max-width: 600px)");
const pagesPanel = document.querySelector(".pages-panel");
const libraryPanel = document.querySelector(".library-panel");
function closePages() {
  if ($("pages-dialog").open) $("pages-dialog").close();
}
function syncPanels() {
  closePages();
  if ($("library-dialog").open) $("library-dialog").close();
  panelView = workspaceView;
  if (
    workspaceView === "organize" ? phoneLayout.matches : compactLayout.matches
  )
    $("pages-dialog").append(pagesPanel);
  else $("workspace").prepend(pagesPanel);
  if (phoneLayout.matches) $("library-dialog").append(libraryPanel);
  else $("workspace").append(libraryPanel);
  if (catalog) fitCanvas();
}
$("show-pages").onclick = () => $("pages-dialog").showModal();
$("close-pages").onclick = closePages;
$("show-library").onclick = () => $("library-dialog").showModal();
$("close-library").onclick = () => $("library-dialog").close();
compactLayout.addEventListener("change", syncPanels);
phoneLayout.addEventListener("change", syncPanels);
syncPanels();
new ResizeObserver(() => {
  if (catalog) fitCanvas();
}).observe(document.querySelector(".canvas-scroll"));
initialize();
