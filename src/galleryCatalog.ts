import { PhotoCard } from "./photos";

export type Gallery = {
  id: string;
  title: string;
  slug: string;
  pages: PhotoCard[];
};
export type LibraryPage = PhotoCard & {
  id: string;
  title: string;
  visible: boolean;
};
export type GalleryCatalog = {
  version: 2;
  pages: LibraryPage[];
  galleries: {
    id: string;
    title: string;
    slug: string;
    visible: boolean;
    pageIds: string[];
  }[];
};

const validPage = (page: any): boolean =>
  page &&
  Array.isArray(page.rows) &&
  page.rows.every(
    (row: any) =>
      Array.isArray(row) &&
      row.every(
        (photo: any) =>
          photo &&
          typeof photo.yearFilename === "string" &&
          typeof photo.title === "string",
      ),
  );
const validGallery = (gallery: any) =>
  gallery &&
  typeof gallery.id === "string" &&
  typeof gallery.title === "string" &&
  typeof gallery.slug === "string";

// Older saved catalogs remain readable until the next edit saves the shared-page format.
export function getVisibleGalleries(catalog: unknown): Gallery[] {
  const value = catalog as any;
  if (!value || !Array.isArray(value.galleries))
    throw new Error("Invalid photo-page catalog");
  if (
    value.version === 1 &&
    value.galleries.every(
      (g: any) =>
        validGallery(g) && Array.isArray(g.pages) && g.pages.every(validPage),
    )
  ) {
    return value.galleries.filter((g: Gallery) => g.pages.length > 0);
  }
  if (
    value.version !== 2 ||
    !Array.isArray(value.pages) ||
    !value.pages.every(
      (p: any) =>
        validPage(p) &&
        typeof p.id === "string" &&
        typeof p.title === "string" &&
        typeof p.visible === "boolean",
    )
  ) {
    throw new Error("Invalid photo-page library");
  }
  const pages = new Map<string, LibraryPage>(
    value.pages.map((page: LibraryPage) => [page.id, page]),
  );
  if (
    pages.size !== value.pages.length ||
    !value.galleries.every(
      (g: any) =>
        validGallery(g) &&
        typeof g.visible === "boolean" &&
        Array.isArray(g.pageIds) &&
        new Set(g.pageIds).size === g.pageIds.length &&
        g.pageIds.every((id: any) => typeof id === "string" && pages.has(id)),
    )
  ) {
    throw new Error("Invalid photo-page gallery references");
  }
  return (value as GalleryCatalog).galleries
    .filter((g) => g.visible)
    .map((g) => ({
      id: g.id,
      title: g.title,
      slug: g.slug,
      pages: g.pageIds
        .map((id) => pages.get(id)!)
        .filter((page) => page.visible),
    }))
    .filter((g) => g.pages.length > 0);
}
