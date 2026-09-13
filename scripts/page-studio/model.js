export const clone = (value) => JSON.parse(JSON.stringify(value));
export const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// A read-time migration also upgrades recovery drafts without changing their base revision.
export function migrateCatalog(value) {
  if (value?.version === 2) return clone(value);
  if (value?.version !== 1 || !Array.isArray(value.galleries))
    throw new Error("Unsupported page catalog.");
  const pages = [];
  const galleries = value.galleries.map((gallery) => ({
    id: gallery.id,
    title: gallery.title,
    slug: gallery.slug,
    visible: true,
    pageIds: gallery.pages.map((page, index) => {
      const id = `${gallery.id}-page-${index + 1}`;
      pages.push({
        id,
        title: `${gallery.title} — Page ${index + 1}`,
        visible: true,
        rows: clone(page.rows),
      });
      return id;
    }),
  }));
  return { version: 2, pages, galleries };
}
export const pagesForGallery = (catalog, gallery) =>
  gallery.pageIds
    .map((id) => catalog.pages.find((page) => page.id === id))
    .filter(Boolean);
export const galleriesForPage = (catalog, id) =>
  catalog.galleries.filter((gallery) => gallery.pageIds.includes(id));
export const photoCount = (pages) =>
  pages.reduce(
    (sum, page) => sum + page.rows.reduce((n, row) => n + row.length, 0),
    0,
  );
export const visibleGalleries = (catalog) =>
  catalog.galleries
    .filter((g) => g.visible)
    .map((g) => ({
      ...g,
      pages: pagesForGallery(catalog, g).filter((p) => p.visible),
    }))
    .filter((g) => g.pages.length > 0);
export function attachPage(catalog, galleryId, pageId) {
  const gallery = catalog.galleries.find((g) => g.id === galleryId);
  if (
    !gallery ||
    !catalog.pages.some((p) => p.id === pageId) ||
    gallery.pageIds.includes(pageId)
  )
    return false;
  gallery.pageIds.push(pageId);
  return true;
}
export function detachPage(catalog, galleryId, pageId) {
  const gallery = catalog.galleries.find((g) => g.id === galleryId);
  if (gallery) gallery.pageIds = gallery.pageIds.filter((id) => id !== pageId);
}
export function deletePage(catalog, id) {
  catalog.pages = catalog.pages.filter((page) => page.id !== id);
  catalog.galleries.forEach((gallery) => {
    gallery.pageIds = gallery.pageIds.filter((pageId) => pageId !== id);
  });
}
export function moveItem(items, index, delta) {
  const target = index + delta;
  if (
    index < 0 ||
    index >= items.length ||
    target < 0 ||
    target >= items.length
  )
    return index;
  const [item] = items.splice(index, 1);
  items.splice(target, 0, item);
  return target;
}
export function movePhoto(catalog, from, to) {
  if (
    !from ||
    !to ||
    !Number.isInteger(from.row) ||
    !Number.isInteger(from.index) ||
    from.index < 0 ||
    !Number.isInteger(to.row) ||
    to.row < 0
  )
    return null;
  const source = catalog.pages.find((p) => p.id === from.pageId)?.rows[
    from.row
  ];
  const destination = catalog.pages.find((p) => p.id === to.pageId);
  const createRow =
    to.newRow === true &&
    destination &&
    to.row === destination.rows.length &&
    destination.rows.length < 12;
  const target = createRow ? [] : destination?.rows[to.row];
  if (!source || !target || !source[from.index] || (to.newRow && !createRow))
    return null;
  if (from.key && source[from.index].yearFilename !== from.key) return null;
  if (source !== target && target.length >= 12) return null;
  let index = to.index ?? target.length;
  if (!Number.isInteger(index) || index < 0 || index > target.length)
    return null;
  if (source === target && from.index < index) index--;
  if (createRow) destination.rows.push(target);
  const [photo] = source.splice(from.index, 1);
  target.splice(index, 0, photo);
  return { pageId: to.pageId, row: to.row, index };
}
// Pointer positions describe insertion boundaries, before removal of the source.
export function photoInsertionIndex(bounds, x) {
  const index = bounds.findIndex((rect) => x < rect.left + rect.width / 2);
  return index < 0 ? bounds.length : index;
}
export function draftIsValid(value) {
  if (
    value?.version !== 2 ||
    !Array.isArray(value.pages) ||
    !Array.isArray(value.galleries)
  )
    return false;
  if (
    value.boxPhotos !== undefined &&
    (!Array.isArray(value.boxPhotos) ||
      value.boxPhotos.length > 600 ||
      !value.boxPhotos.every(
        (key) =>
          typeof key === "string" &&
          /^\d{4}\//.test(key) &&
          key
            .split("/")
            .every(
              (part) =>
                part && !part.startsWith(".") && !/[\\\x00-\x1f]/.test(part),
            ),
      ) ||
      new Set(value.boxPhotos).size !== value.boxPhotos.length)
  )
    return false;
  const ids = new Set(value.pages.map((page) => page?.id));
  if (ids.size !== value.pages.length) return false;
  return (
    value.pages.every(
      (p) =>
        p != null &&
        typeof p.id === "string" &&
        typeof p.title === "string" &&
        typeof p.visible === "boolean" &&
        Array.isArray(p.rows) &&
        p.rows.every(
          (r) =>
            Array.isArray(r) &&
            r.every(
              (photo) =>
                photo &&
                typeof photo.yearFilename === "string" &&
                typeof photo.title === "string",
            ),
        ),
    ) &&
    value.galleries.every(
      (g) =>
        g != null &&
        typeof g.id === "string" &&
        typeof g.title === "string" &&
        typeof g.slug === "string" &&
        typeof g.visible === "boolean" &&
        Array.isArray(g.pageIds) &&
        new Set(g.pageIds).size === g.pageIds.length &&
        g.pageIds.every((id) => ids.has(id)),
    )
  );
}
