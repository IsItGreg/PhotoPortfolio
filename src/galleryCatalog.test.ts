import { GalleryCatalog, getVisibleGalleries } from "./galleryCatalog";
import { getCompressedImageSrc, getFullresImageSrc } from "./photos";

test("photo URLs preserve folders and encode special characters within filenames", () => {
  expect(getCompressedImageSrc("2026/infrared/same")).toBe(
    `${process.env.PUBLIC_URL}/images/twodim/2026/infrared/same_small.webp`,
  );
  expect(getFullresImageSrc("2026/infrared/evening #1")).toBe(
    `${process.env.PUBLIC_URL}/images/twodim/2026/infrared/evening%20%231_full.webp`,
  );
});

const fixture = (): GalleryCatalog => ({
  version: 2,
  pages: [
    {
      id: "a",
      title: "First",
      visible: true,
      rows: [
        [{ yearFilename: "2026/a", title: "Original", location: "", date: "" }],
      ],
    },
    {
      id: "b",
      title: "Second",
      visible: true,
      rows: [
        [{ yearFilename: "2026/b", title: "Second", location: "", date: "" }],
      ],
    },
    { id: "c", title: "Unassigned", visible: true, rows: [] },
  ],
  galleries: [
    {
      id: "nyc",
      title: "NYC",
      slug: "nyc",
      visible: true,
      pageIds: ["b", "a"],
    },
    {
      id: "favorites",
      title: "Favorites",
      slug: "favorites",
      visible: true,
      pageIds: ["a"],
    },
  ],
});

test("visible routes follow gallery order and membership order", () => {
  const catalog = fixture();
  catalog.galleries.reverse();
  const galleries = getVisibleGalleries(catalog);
  expect(galleries.map((g) => g.slug)).toEqual(["favorites", "nyc"]);
  expect(galleries[1].pages.map((p) => p.rows[0][0].yearFilename)).toEqual([
    "2026/b",
    "2026/a",
  ]);
});
test("hidden galleries, globally hidden pages, and galleries without visible pages are excluded", () => {
  const catalog = fixture();
  catalog.pages[0].visible = false;
  expect(getVisibleGalleries(catalog).map((g) => g.slug)).toEqual(["nyc"]);
  expect(getVisibleGalleries(catalog)[0].pages).toEqual([catalog.pages[1]]);
  catalog.galleries[0].visible = false;
  expect(getVisibleGalleries(catalog)).toEqual([]);
});
test("a shared page supplies the same edited content in every gallery", () => {
  const catalog = fixture();
  catalog.pages[0].rows[0][0].title = "Updated";
  const galleries = getVisibleGalleries(catalog);
  expect(galleries[0].pages[1]).toBe(galleries[1].pages[0]);
  expect(galleries[1].pages[0].rows[0][0].title).toBe("Updated");
});
test("legacy catalogs load without rewriting or reordering", () => {
  const pages = fixture().pages.map(({ rows }) => ({ rows }));
  const old = {
    version: 1,
    galleries: [{ id: "nyc", title: "NYC", slug: "nyc", pages }],
  };
  expect(getVisibleGalleries(old)).toEqual(old.galleries);
  expect(old.version).toBe(1);
});
test("invalid references fail closed instead of showing old fallback content", () => {
  const catalog = fixture();
  catalog.galleries[0].pageIds.push("missing");
  expect(() => getVisibleGalleries(catalog)).toThrow();
  expect(() => getVisibleGalleries({})).toThrow();
  expect(getVisibleGalleries({ version: 2, pages: [], galleries: [] })).toEqual(
    [],
  );
});
