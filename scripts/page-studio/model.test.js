import test from "node:test";
import assert from "node:assert/strict";
import {
  movePhoto,
  photoInsertionIndex,
  moveItem,
  clone,
  migrateCatalog,
  pagesForGallery,
  galleriesForPage,
  attachPage,
  detachPage,
  deletePage,
  visibleGalleries,
  draftIsValid,
} from "./model.js";
const photo = (title) => ({
  yearFilename: "2026/" + title,
  title,
  location: "",
  date: "",
});
const fixture = () => ({
  version: 2,
  pages: [
    {
      id: "a",
      title: "First",
      visible: true,
      rows: [[photo("a"), photo("b"), photo("c")], [photo("d")]],
    },
    { id: "b", title: "Second", visible: true, rows: [[photo("e")]] },
    { id: "c", title: "Unassigned", visible: false, rows: [[]] },
  ],
  galleries: [
    {
      id: "travel",
      title: "Travel",
      slug: "travel",
      visible: true,
      pageIds: ["a", "b"],
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
const where = (row, index, pageId = "a") => ({ pageId, row, index });
test("moving within a row preserves every photo and insertion order", () => {
  const draft = fixture();
  assert.deepEqual(movePhoto(draft, where(0, 0), where(0, 3)), where(0, 2));
  assert.deepEqual(
    draft.pages[0].rows[0].map((p) => p.title),
    ["b", "c", "a"],
  );
  movePhoto(draft, where(0, 2), where(0, 0));
  assert.deepEqual(
    draft.pages[0].rows[0].map((p) => p.title),
    ["a", "b", "c"],
  );
});
test("moving between pages uses stable identifiers after reordering", () => {
  const draft = fixture();
  moveItem(draft.pages, 0, 1);
  movePhoto(draft, where(1, 0), where(0, undefined, "b"));
  assert.deepEqual(draft.pages.find((p) => p.id === "a").rows[1], []);
  assert.deepEqual(
    draft.pages.find((p) => p.id === "b").rows[0].map((p) => p.title),
    ["e", "d"],
  );
});
test("invalid drag positions cannot remove a photo", () => {
  const draft = fixture(),
    before = clone(draft);
  assert.equal(movePhoto(draft, where(0, 99), where(1)), null);
  assert.equal(movePhoto(draft, where(0, 0), where(99)), null);
  assert.deepEqual(draft, before);
});
test("insertion follows photo midpoints, including gaps and the end of a row", () => {
  const bounds = [
    { left: 10, width: 80 },
    { left: 100, width: 200 },
  ];
  assert.deepEqual(
    [0, 49, 50, 95, 199, 200, 400].map((x) => photoInsertionIndex(bounds, x)),
    [0, 0, 1, 1, 1, 2, 2],
  );
  assert.equal(photoInsertionIndex([], 100), 0);
});
test("moves reject stale sources and invalid destinations without changing the catalog", () => {
  const draft = fixture(),
    before = clone(draft);
  for (const index of [-1, 99, 0.5, NaN])
    assert.equal(movePhoto(draft, where(0, 0), where(1, index)), null);
  assert.equal(
    movePhoto(draft, { ...where(0, 0), key: "2026/stale" }, where(1, 0)),
    null,
  );
  assert.equal(
    movePhoto(draft, where(0, 0), { ...where(3, 0), newRow: true }),
    null,
  );
  assert.deepEqual(draft, before);
});
test("capacity limits permit reordering a full row and make new-row moves atomic", () => {
  const draft = fixture();
  draft.pages[1].rows = [
    Array.from({ length: 12 }, (_, i) => photo(String(i))),
  ];
  const before = clone(draft);
  assert.equal(movePhoto(draft, where(0, 0), where(0, 0, "b")), null);
  assert.deepEqual(draft, before);
  assert.deepEqual(
    movePhoto(draft, where(0, 0, "b"), where(0, 12, "b")),
    where(0, 11, "b"),
  );
  assert.deepEqual(
    movePhoto(draft, where(0, 0), { ...where(1, 0, "b"), newRow: true }),
    where(1, 0, "b"),
  );
  assert.equal(draft.pages[1].rows[1][0].title, "a");
  while (draft.pages[1].rows.length < 12) draft.pages[1].rows.push([]);
  const full = clone(draft);
  assert.equal(
    movePhoto(draft, where(0, 0), { ...where(12, 0, "b"), newRow: true }),
    null,
  );
  assert.deepEqual(draft, full);
});
test("shared membership keeps one page and reflects edits everywhere", () => {
  const draft = fixture();
  assert.equal(attachPage(draft, "favorites", "b"), true);
  assert.equal(attachPage(draft, "favorites", "b"), false);
  assert.equal(draft.pages.length, 3);
  draft.pages[0].rows[0][0].title = "Shared edit";
  for (const g of draft.galleries)
    assert.equal(pagesForGallery(draft, g)[0].rows[0][0].title, "Shared edit");
  assert.equal(galleriesForPage(draft, "b").length, 2);
});
test("detaching keeps the page and other memberships; deleting cleans all references", () => {
  const draft = fixture();
  detachPage(draft, "favorites", "a");
  assert.equal(draft.pages.length, 3);
  assert.deepEqual(draft.galleries[0].pageIds, ["a", "b"]);
  assert.deepEqual(draft.galleries[1].pageIds, []);
  attachPage(draft, "favorites", "a");
  deletePage(draft, "a");
  assert.equal(draft.pages.length, 2);
  assert.deepEqual(
    draft.galleries.map((g) => g.pageIds),
    [["b"], []],
  );
  assert.equal(draftIsValid(draft), true);
});
test("gallery and membership order are independent of library order", () => {
  const draft = fixture();
  moveItem(draft.galleries[0].pageIds, 0, 1);
  moveItem(draft.pages, 0, 2);
  moveItem(draft.galleries, 1, -1);
  assert.deepEqual(
    visibleGalleries(draft).map((g) => g.slug),
    ["favorites", "travel"],
  );
  assert.deepEqual(
    visibleGalleries(draft).map((g) => g.pages.map((p) => p.id)),
    [["a"], ["b", "a"]],
  );
  assert.equal(moveItem(draft.galleries, 0, -1), 0);
});
test("global visibility hides shared pages and omits hidden or empty galleries", () => {
  const draft = fixture();
  draft.pages[0].visible = false;
  assert.deepEqual(
    visibleGalleries(draft).map((g) => [g.slug, g.pages.map((p) => p.id)]),
    [["travel", ["b"]]],
  );
  draft.galleries[0].visible = false;
  assert.deepEqual(visibleGalleries(draft), []);
  assert.equal(draft.pages.length, 3);
});
test("migration preserves legacy content and order, including recovery drafts", () => {
  const old = {
    version: 1,
    galleries: [
      {
        id: "nyc",
        title: "NYC",
        slug: "nyc",
        pages: [{ rows: [[photo("a")]] }, { rows: [[photo("b")]] }],
      },
    ],
  };
  const before = clone(old),
    migrated = migrateCatalog(old);
  assert.equal(draftIsValid(migrated), true);
  assert.deepEqual(migrated.galleries[0].pageIds, ["nyc-page-1", "nyc-page-2"]);
  assert.deepEqual(
    pagesForGallery(migrated, migrated.galleries[0]).map((p) => p.rows),
    old.galleries[0].pages.map((p) => p.rows),
  );
  assert.deepEqual(old, before);
  assert.deepEqual(migrateCatalog(migrated), migrated);
});
test("draft validation rejects dangling and duplicate references and permits an empty library", () => {
  const draft = fixture();
  draft.galleries[0].pageIds.push("missing");
  assert.equal(draftIsValid(draft), false);
  assert.equal(
    draftIsValid({ version: 2, pages: [null], galleries: [] }),
    false,
  );
  assert.equal(
    draftIsValid({ version: 2, pages: [], galleries: [null] }),
    false,
  );
  draft.galleries[0].pageIds = ["a", "a"];
  assert.equal(draftIsValid(draft), false);
  assert.equal(draftIsValid({ version: 2, galleries: [], pages: [] }), true);
});
