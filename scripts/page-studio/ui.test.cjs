const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { JSDOM, VirtualConsole } = require("jsdom");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const fixture = () => ({
  version: 2,
  pages: [
    {
      id: "first",
      title: "First page",
      visible: true,
      rows: [
        [
          {
            yearFilename: "2026/infrared/one",
            title: "One",
            location: "NYC",
            date: "2026",
          },
        ],
      ],
    },
    {
      id: "second",
      title: "Second page",
      visible: true,
      rows: [
        [
          {
            yearFilename: "2025/two",
            title: "Two",
            location: "NYC",
            date: "2025",
          },
        ],
      ],
    },
  ],
  galleries: [
    {
      id: "nyc",
      title: "NYC",
      slug: "nyc",
      visible: true,
      pageIds: ["first", "second"],
    },
    {
      id: "favorites",
      title: "Favorites",
      slug: "favorites",
      visible: true,
      pageIds: ["first"],
    },
  ],
});
async function editor(t, width = 694, mode = "edit", prepare = () => {}) {
  const errors = [],
    virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "index.html"), "utf8"),
    {
      url: "http://localhost:8767",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole,
    },
  );
  t.after(() => dom.window.close());
  const w = dom.window,
    doc = w.document,
    requests = [];
  w.matchMedia = (query) => ({
    matches: query.includes("1101")
      ? width >= 1101
      : query.includes("1100")
        ? width <= 1100
        : width <= 600,
    addEventListener() {},
  });
  w.ResizeObserver = class {
    observe() {}
  };
  w.crypto = { randomUUID };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new w.Event("close"));
  };
  const catalog = fixture();
  prepare(catalog);
  const photos = catalog.pages
    .flatMap((p) => p.rows.flat())
    .map((p) => ({
      key: p.yearFilename,
      year: p.yearFilename.split("/")[0],
      group: p.yearFilename.includes("infrared") ? "infrared" : "",
      filename: p.yearFilename.split("/").at(-1) + ".webp",
      photo: p,
    }));
  w.fetch = async (url, options) => {
    if (url === "/api/catalog")
      return {
        ok: true,
        json: async () => ({ catalog, revision: "original" }),
      };
    if (url === "/api/library")
      return { ok: true, json: async () => ({ photos }) };
    if (url === "/api/box")
      return {
        ok: true,
        json: async () => ({ keys: ["2025/two"], revision: "box-original" }),
      };
    const payload = JSON.parse(options.body);
    requests.push(payload);
    return {
      ok: true,
      json: async () => ({
        catalog: payload.catalog,
        box: { keys: payload.boxKeys, revision: "box-updated" },
        revision: "updated",
        prepared: 0,
      }),
    };
  };
  Object.assign(w, await import("./model.js"));
  const organizerSource = fs
    .readFileSync(path.join(__dirname, "organizer.js"), "utf8")
    .replace(/^import[\s\S]*?from "\.\/model.js";/, "")
    .replace("export function createOrganizer", "function createOrganizer");
  w.eval(organizerSource + ";window.createOrganizer = createOrganizer;");
  const boxSource = fs
    .readFileSync(path.join(__dirname, "box-studio.js"), "utf8")
    .replace(/^import[^;]*;/, "")
    .replace("export function createBoxStudio", "function createBoxStudio");
  w.eval(boxSource + ";window.createBoxStudio = createBoxStudio;");
  const source = fs
    .readFileSync(path.join(__dirname, "studio.js"), "utf8")
    .replace(/^import\s+\{[\s\S]*?\}\s+from "\.\/model.js";/, "")
    .replace(/import \{ createOrganizer \} from "\.\/organizer.js";/, "")
    .replace(/import \{ createBoxStudio \} from "\.\/box-studio.js";/, "");
  w.eval("(() => {" + source + "})()");
  await tick();
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  if (mode === "edit") doc.querySelector("#edit-view").click();
  const input = (element, value) => {
    element.value = value;
    element.dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  const select = (id, value) => {
    if (id === "gallery") {
      doc
        .querySelector(
          `[data-gallery-id="${catalog.galleries[Number(value)].id}"]`,
        )
        .click();
      doc.querySelector("#edit-view").click();
      return;
    }
    const el = doc.getElementById(id);
    el.value = value;
    el.dispatchEvent(new w.Event("change", { bubbles: true }));
  };
  return { w, doc, requests, input, select };
}
test("metadata becomes saveable while typing and retains input focus and value", async (t) => {
  const { doc, input, requests } = await editor(t);
  doc.querySelector(".canvas-photo").click();
  const field = doc.querySelector(".inspector-fields input");
  field.focus();
  input(field, "Updated title");
  assert.equal(doc.activeElement, field);
  assert.equal(doc.querySelector(".inspector-fields input"), field);
  assert.equal(doc.querySelector("#save").disabled, false);
  doc.querySelector("#save").click();
  await tick();
  assert.equal(requests[0].catalog.pages[0].rows[0][0].title, "Updated title");
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
});
test("a continuous page-name edit uses one undo step and preserves the field", async (t) => {
  const { doc, input } = await editor(t);
  const field = doc.querySelector("#page-name");
  field.focus();
  input(field, "N");
  input(field, "New");
  input(field, "New title");
  assert.equal(doc.activeElement, field);
  assert.equal(doc.querySelector("#page-title").textContent, "New title");
  doc.querySelector("#undo").click();
  assert.equal(field.value, "First page");
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  doc.querySelector("#redo").click();
  assert.equal(field.value, "New title");
});
test("undo restores the selected gallery and page after gallery and page reordering", async (t) => {
  const { doc, select } = await editor(t);
  select("gallery", "0");
  doc.querySelector("#gallery-down").click();
  doc.querySelector("#undo").click();
  assert.equal(
    doc.querySelector('.gallery-nav-item[aria-current="page"] strong')
      .textContent,
    "NYC",
  );
  assert.deepEqual(
    [...doc.querySelectorAll(".gallery-nav-item strong")].map(
      (o) => o.textContent,
    ),
    ["All pages", "NYC", "Favorites"],
  );
  doc.querySelectorAll(".page-select")[1].click();
  doc.querySelector('[aria-label="Move Second page earlier"]').click();
  doc.querySelector("#undo").click();
  assert.equal(doc.querySelector("#page-title").textContent, "Second page");
  assert.equal(
    doc.querySelector(".page-select").getAttribute("aria-label"),
    "Edit First page",
  );
});
test("preview blocks editing and accurately describes saved versus draft content", async (t) => {
  const { doc, w } = await editor(t);
  doc.querySelector("#preview").click();
  assert.equal(
    doc.querySelector("#page-description").textContent,
    "Previewing saved pages",
  );
  assert.equal(doc.querySelector("#add-page").disabled, true);
  assert.equal(doc.querySelector("#page-visibility button").disabled, true);
  assert.equal(doc.querySelector("#undo").disabled, true);
  doc.querySelectorAll("#page-visibility button")[1].click();
  doc.querySelector("#preview").click();
  assert.equal(
    doc.querySelector('#page-visibility button[aria-pressed="true"]')
      .textContent,
    "Visible",
  );
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
});
test("folder prefixes do not obscure filenames and compact pages use a closable drawer", async (t) => {
  const { doc } = await editor(t);
  assert.equal(doc.querySelector(".file-name").textContent, "one");
  assert.equal(doc.querySelector(".file-name").title, "2026/infrared/one");
  assert.equal(
    doc.querySelector(".pages-panel").parentElement.id,
    "pages-dialog",
  );
  doc.querySelector("#show-pages").click();
  assert.equal(doc.querySelector("#pages-dialog").open, true);
  doc.querySelector(".page-select").click();
  assert.equal(doc.querySelector("#pages-dialog").open, false);
});
test("the library indicates the active row after a canvas selection", async (t) => {
  const { doc } = await editor(t);
  doc.querySelector("#add-row").click();
  assert.match(doc.querySelector("#library-hint").textContent, /Row 2/);
  doc.querySelector(".canvas-photo").click();
  assert.match(doc.querySelector("#library-hint").textContent, /Row 1/);
});
test("attachment action stays disabled until a page is selected", async (t) => {
  const { doc, select, w } = await editor(t);
  select("gallery", "1");
  doc.querySelector("#add-existing").click();
  assert.equal(doc.querySelector("#attach-submit").disabled, true);
  const checkbox = doc.querySelector('input[name="attach-page"]');
  checkbox.checked = true;
  checkbox.dispatchEvent(new w.Event("change"));
  assert.equal(doc.querySelector("#attach-submit").disabled, false);
  assert.equal(doc.querySelector("#attach-submit").textContent, "Add 1 page");
});
test("desktop keeps the page panel inline and phone photo additions close the photo drawer", async (t) => {
  const desktop = await editor(t, 1280);
  assert.equal(
    desktop.doc.querySelector(".pages-panel").parentElement.id,
    "workspace",
  );
  const phone = await editor(t, 390);
  phone.doc.querySelector("#show-library").click();
  assert.equal(phone.doc.querySelector("#library-dialog").open, true);
  phone.doc.querySelector(".library-add").click();
  assert.equal(phone.doc.querySelector("#library-dialog").open, false);
  assert.equal(phone.doc.querySelector("#status").textContent, "Unsaved draft");
});

const clickText = (root, text) => {
  const button = [...root.querySelectorAll("button")].find(
    (button) => button.textContent === text,
  );
  assert.ok(button, `Button exists: ${text}`);
  button.click();
};
const check = (w, element, checked = true) => {
  element.checked = checked;
  element.dispatchEvent(new w.Event("change", { bubbles: true }));
};
test("organizer starts with an inline gallery list, switches layouts without editing, and opens the editor", async (t) => {
  const { doc } = await editor(t, 694, "organize");
  assert.equal(doc.querySelector(".pages-panel").parentElement.id, "workspace");
  assert.equal(doc.querySelector("#organizer").hidden, false);
  assert.equal(doc.querySelector("#gallery"), null);
  clickText(doc.querySelector("#organizer"), "List");
  assert.ok(doc.querySelector(".organizer-pages.list"));
  assert.equal(doc.querySelector("#save").disabled, true);
  doc.querySelector('#organizer [aria-label="Edit Second page"]').click();
  assert.equal(doc.querySelector("#page-title").textContent, "Second page");
  assert.equal(doc.querySelector("#organizer").hidden, true);
  assert.equal(
    doc.querySelector(".pages-panel").parentElement.id,
    "pages-dialog",
  );
  doc.querySelector("#organize-view").click();
  assert.ok(doc.querySelector(".organizer-pages.list"));
});
test("bulk visibility changes shared pages globally, explains empty galleries, and is undoable", async (t) => {
  const { doc, w, requests } = await editor(t, 694, "organize");
  doc.querySelector('[data-gallery-id="nyc"]').click();
  check(w, doc.querySelector('#organizer [aria-label="Select First page"]'));
  check(w, doc.querySelector('#organizer [aria-label="Select Second page"]'));
  clickText(doc.querySelector(".bulk-actions"), "Hide");
  assert.match(
    doc.querySelector(".organizer-notice").textContent,
    /All 2 pages are hidden/,
  );
  assert.match(
    doc.querySelector('[data-gallery-id="favorites"]').textContent,
    /0 visible/,
  );
  doc.querySelector("#save").click();
  await tick();
  assert.ok(requests[0].catalog.pages.every((page) => !page.visible));
  doc.querySelector("#undo").click();
  assert.equal(doc.querySelector(".organizer-notice"), null);
  assert.equal(doc.querySelectorAll("#organizer input:checked").length, 2);
  assert.match(
    doc.querySelector('[data-gallery-id="favorites"]').textContent,
    /1 visible/,
  );
});
test("bulk attachments deduplicate references and removal preserves other galleries and the library", async (t) => {
  const { doc, w, requests } = await editor(t, 694, "organize");
  doc.querySelector('[data-gallery-id="nyc"]').click();
  check(w, doc.querySelector('#organizer [aria-label="Select First page"]'));
  check(w, doc.querySelector('#organizer [aria-label="Select Second page"]'));
  clickText(doc.querySelector(".bulk-actions"), "Add to gallery");
  assert.equal(doc.querySelector("#membership-submit").disabled, true);
  check(w, doc.querySelector('input[name="membership"][value="favorites"]'));
  doc
    .querySelector("#membership-form")
    .dispatchEvent(new w.Event("submit", { cancelable: true }));
  clickText(doc.querySelector(".bulk-actions"), "Remove from gallery");
  doc.querySelector("#save").click();
  await tick();
  const saved = requests[0].catalog;
  assert.equal(saved.pages.length, 2);
  assert.deepEqual(saved.galleries[0].pageIds, []);
  assert.deepEqual(saved.galleries[1].pageIds, ["first", "second"]);
  doc.querySelector("#undo").click();
  assert.equal(doc.querySelectorAll(".organizer-page").length, 2);
});
test("removing the edited page from its current gallery keeps that page open in All pages", async (t) => {
  const { doc, w, select, requests } = await editor(t);
  select("gallery", "0");
  doc.querySelector("#page-galleries").click();
  check(w, doc.querySelector('input[name="membership"][value="nyc"]'), false);
  doc
    .querySelector("#membership-form")
    .dispatchEvent(new w.Event("submit", { cancelable: true }));
  assert.equal(doc.querySelector("#page-title").textContent, "First page");
  assert.equal(
    doc.querySelector('.gallery-nav-item[aria-current="page"] strong')
      .textContent,
    "All pages",
  );
  doc.querySelector("#save").click();
  await tick();
  assert.deepEqual(requests[0].catalog.galleries[0].pageIds, ["second"]);
  assert.deepEqual(requests[0].catalog.galleries[1].pageIds, ["first"]);
});
test("organizer drag order is gallery-specific and undo preserves the view", async (t) => {
  const { doc, w, requests } = await editor(t, 694, "organize");
  doc.querySelector('[data-gallery-id="nyc"]').click();
  const drop = new w.Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(drop, "dataTransfer", {
    value: {
      getData: () =>
        JSON.stringify({
          kind: "organizer-page",
          id: "second",
          galleryId: "nyc",
        }),
    },
  });
  doc
    .querySelector('.organizer-page[data-page-id="first"]')
    .dispatchEvent(drop);
  assert.equal(doc.querySelector(".organizer-page").dataset.pageId, "second");
  doc.querySelector("#save").click();
  await tick();
  assert.deepEqual(requests[0].catalog.galleries[0].pageIds, [
    "second",
    "first",
  ]);
  assert.deepEqual(
    requests[0].catalog.pages.map((p) => p.id),
    ["first", "second"],
  );
  doc.querySelector("#undo").click();
  assert.equal(doc.querySelector("#organizer").hidden, false);
  assert.equal(doc.querySelector(".organizer-page").dataset.pageId, "first");
});
test("new pages and duplicated pages start hidden, with independent photo data", async (t) => {
  const { doc, requests, input } = await editor(t, 694, "organize");
  clickText(doc.querySelector("#organizer"), "New page");
  assert.equal(
    doc.querySelector('#page-visibility button[aria-pressed="true"]')
      .textContent,
    "Hidden",
  );
  assert.equal(doc.querySelector("#organizer").hidden, true);
  doc.querySelector("#organize-view").click();
  doc.querySelector('#organizer [aria-label="Edit First page"]').click();
  doc.querySelector("#duplicate-page").click();
  assert.equal(
    doc.querySelector('#page-visibility button[aria-pressed="true"]')
      .textContent,
    "Hidden",
  );
  doc.querySelector(".canvas-photo").click();
  input(doc.querySelector(".inspector-fields input"), "Independent title");
  doc.querySelector("#save").click();
  await tick();
  assert.equal(requests[0].catalog.pages.length, 4);
  assert.equal(requests[0].catalog.pages[0].rows[0][0].title, "One");
  assert.equal(
    requests[0].catalog.pages[3].rows[0][0].title,
    "Independent title",
  );
});

function movementFixture(catalog) {
  const photo = (name) => ({
    yearFilename: `2026/${name.toLowerCase()}`,
    title: name,
    location: "",
    date: "",
  });
  catalog.pages[0].rows = [[photo("A"), photo("B"), photo("C")], [photo("D")]];
  catalog.pages[1].rows = [[photo("E")], [photo("F")]];
}
const canvasOrder = (doc) =>
  [...doc.querySelectorAll("#canvas .photo-row")].map((row) =>
    [...row.querySelectorAll(".canvas-photo img")].map((img) => img.alt),
  );
function dragEvent(w, node, type, dataTransfer, x = 0) {
  const event = new w.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { dataTransfer, clientX: x, clientY: 50 });
  node.dispatchEvent(event);
  return event;
}
function transfer() {
  const values = {};
  return {
    setData: (type, value) => (values[type] = value),
    getData: (type) => values[type] || "",
  };
}
function rowBounds(doc, r = 0) {
  const row = doc.querySelectorAll("#canvas .photo-row")[r];
  row.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    right: 400,
    bottom: 100,
  });
  row.querySelectorAll(".canvas-photo").forEach((tile, i) => {
    tile.getBoundingClientRect = () => ({
      left: i * 110,
      width: 100,
      right: i * 110 + 100,
    });
  });
  return row;
}
test("clicking and cancelling a drag preserves tiles, selection and a clean draft", async (t) => {
  const { w, doc } = await editor(t, 1400, "edit", movementFixture);
  const tile = doc.querySelectorAll(".canvas-photo")[1];
  tile.focus();
  tile.click();
  assert.equal(doc.querySelectorAll(".canvas-photo")[1], tile);
  assert.equal(doc.activeElement, tile);
  assert.equal(tile.getAttribute("aria-pressed"), "true");
  const row = rowBounds(doc),
    data = transfer();
  dragEvent(w, tile, "dragstart", data);
  dragEvent(w, row, "dragover", data, 290);
  assert.ok(doc.querySelector(".photo-drop-marker"));
  assert.equal(doc.querySelectorAll(".canvas-photo")[1], tile);
  dragEvent(w, tile, "dragend", data);
  assert.equal(doc.querySelector(".photo-drop-marker, .drag-source"), null);
  assert.equal(doc.body.classList.contains("photo-dragging"), false);
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  assert.equal(doc.querySelector("#undo").disabled, true);
});
test("dragging into either half of a photo uses the shown insertion position and one undo step", async (t) => {
  const { w, doc } = await editor(t, 1400, "edit", movementFixture);
  for (const [x, expected] of [
    [240, ["B", "A", "C"]],
    [290, ["B", "C", "A"]],
  ]) {
    const row = rowBounds(doc),
      data = transfer();
    dragEvent(w, row.querySelector(".canvas-photo"), "dragstart", data);
    dragEvent(w, row, "dragover", data, x);
    dragEvent(w, row, "drop", data, x);
    assert.deepEqual(canvasOrder(doc)[0], expected);
    assert.equal(doc.activeElement.querySelector("img").alt, "A");
    assert.equal(doc.querySelector(".photo-drop-marker, .drag-source"), null);
    doc.querySelector("#undo").click();
    assert.deepEqual(canvasOrder(doc), [["A", "B", "C"], ["D"]]);
    assert.equal(doc.querySelector("#undo").disabled, true);
  }
});
test("photo drags move between rows, library drags copy, and external drops do nothing", async (t) => {
  const { w, doc } = await editor(t, 1400, "edit", movementFixture);
  let data = transfer(),
    row = rowBounds(doc, 1);
  dragEvent(w, doc.querySelector(".canvas-photo"), "dragstart", data);
  dragEvent(w, row, "drop", data, 100);
  assert.deepEqual(canvasOrder(doc), [
    ["B", "C"],
    ["D", "A"],
  ]);
  doc.querySelector("#undo").click();
  data = transfer();
  row = rowBounds(doc, 1);
  dragEvent(
    w,
    doc.querySelector('.library-photo [draggable="true"]') ||
      doc.querySelector('#library [draggable="true"]'),
    "dragstart",
    data,
  );
  dragEvent(w, row, "drop", data, 0);
  assert.deepEqual(canvasOrder(doc), [
    ["A", "B", "C"],
    ["A", "D"],
  ]);
  doc.querySelector("#undo").click();
  data = transfer();
  data.setData(
    "application/x-page-studio",
    JSON.stringify({
      kind: "photo",
      from: { pageId: "first", row: 0, index: 0 },
    }),
  );
  dragEvent(w, rowBounds(doc, 1), "drop", data, 0);
  assert.deepEqual(canvasOrder(doc), [["A", "B", "C"], ["D"]]);
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
});
test("dropping on Add row creates and fills one row in a single undo step", async (t) => {
  const { w, doc } = await editor(t, 1400, "edit", movementFixture),
    data = transfer();
  dragEvent(w, doc.querySelector(".canvas-photo"), "dragstart", data);
  dragEvent(w, doc.querySelector("#add-row"), "drop", data);
  assert.deepEqual(canvasOrder(doc), [["B", "C"], ["D"], ["A"]]);
  doc.querySelector("#undo").click();
  assert.deepEqual(canvasOrder(doc), [["A", "B", "C"], ["D"]]);
  assert.equal(doc.querySelector("#undo").disabled, true);
});
test("Move photo destinations stay provisional until confirmed and work across gallery membership", async (t) => {
  const { doc, select } = await editor(t, 1400, "edit", movementFixture);
  select("gallery", "1");
  doc.querySelector(".canvas-photo").click();
  clickText(doc, "Move photo…");
  assert.equal(doc.querySelector("#move-photo-submit").disabled, true);
  select("move-photo-page", "second");
  select("move-photo-row", "1");
  select("move-photo-position", "0");
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  assert.deepEqual(canvasOrder(doc), [["A", "B", "C"], ["D"]]);
  doc.querySelector("#move-photo-cancel").click();
  assert.equal(doc.querySelector("#undo").disabled, true);
  clickText(doc, "Move photo…");
  select("move-photo-page", "second");
  select("move-photo-row", "1");
  select("move-photo-position", "0");
  doc.querySelector("#move-photo-submit").click();
  assert.equal(doc.querySelector("#move-photo-dialog").open, false);
  assert.equal(doc.querySelector("#page-title").textContent, "Second page");
  assert.deepEqual(canvasOrder(doc), [["E"], ["A", "F"]]);
  assert.equal(doc.activeElement.querySelector("img").alt, "A");
  doc.querySelector("#undo").click();
  assert.equal(doc.querySelector("#page-title").textContent, "First page");
  assert.deepEqual(canvasOrder(doc), [["A", "B", "C"], ["D"]]);
  assert.equal(doc.querySelector("#undo").disabled, true);
});
test("Move photo handles same-row final positions without an off-by-one error", async (t) => {
  const { doc, select } = await editor(t, 1400, "edit", movementFixture);
  doc.querySelector(".canvas-photo").click();
  clickText(doc, "Move photo…");
  select("move-photo-position", "2");
  doc.querySelector("#move-photo-submit").click();
  assert.deepEqual(canvasOrder(doc)[0], ["B", "C", "A"]);
  clickText(doc, "Move photo…");
  select("move-photo-position", "0");
  doc.querySelector("#move-photo-submit").click();
  assert.deepEqual(canvasOrder(doc)[0], ["A", "B", "C"]);
});
test("Option/Alt arrows move the focused photo and preserve focus for repeated moves", async (t) => {
  const { w, doc } = await editor(t, 1400, "edit", movementFixture);
  doc.querySelector(".canvas-photo").focus();
  doc.activeElement.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.deepEqual(canvasOrder(doc), [["B", "A", "C"], ["D"]]);
  assert.equal(doc.activeElement.querySelector("img").alt, "A");
  doc.activeElement.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      key: "ArrowDown",
      altKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.deepEqual(canvasOrder(doc), [
    ["B", "C"],
    ["D", "A"],
  ]);
  assert.equal(doc.activeElement.querySelector("img").alt, "A");
  doc.querySelector("#undo").click();
  assert.deepEqual(canvasOrder(doc), [["B", "A", "C"], ["D"]]);
  doc.querySelector("#undo").click();
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
});
test("full rows refuse new photos but allow reordering, and cancelled drags cannot drop later", async (t) => {
  const { w, doc } = await editor(t, 1400, "edit", (catalog) => {
    movementFixture(catalog);
    catalog.pages[0].rows[1] = Array.from({ length: 12 }, (_, i) => ({
      ...catalog.pages[1].rows[0][0],
      title: `Full ${i}`,
    }));
  });
  let data = transfer(),
    row = rowBounds(doc, 1);
  dragEvent(w, doc.querySelector(".canvas-photo"), "dragstart", data);
  const hover = dragEvent(w, row, "dragover", data, 50);
  assert.equal(hover.defaultPrevented, false);
  assert.equal(data.dropEffect, "none");
  assert.equal(doc.querySelector(".photo-drop-marker"), null);
  dragEvent(w, row, "drop", data, 50);
  assert.equal(canvasOrder(doc)[0][0], "A");
  assert.equal(canvasOrder(doc)[1].length, 12);
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  row = rowBounds(doc, 1);
  data = transfer();
  dragEvent(w, row.querySelector(".canvas-photo"), "dragstart", data);
  assert.equal(
    dragEvent(w, row, "dragover", data, 1400).defaultPrevented,
    true,
  );
  dragEvent(w, row, "drop", data, 1400);
  assert.equal(canvasOrder(doc)[1].at(-1), "Full 0");
  doc.querySelector("#undo").click();
  data = transfer();
  dragEvent(w, doc.querySelector(".canvas-photo"), "dragstart", data);
  w.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
  dragEvent(w, doc.querySelector("#add-row"), "drop", data);
  assert.equal(canvasOrder(doc).length, 2);
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
});

test("photo box imports its saved selection and stays independent of gallery pages", async (t) => {
  const { doc, requests } = await editor(t);
  const pagesBefore = canvasOrder(doc);
  doc.querySelector("#box-view").click();
  assert.equal(doc.querySelector("#box-studio").hidden, false);
  assert.deepEqual(
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key),
    ["2025/two"],
  );
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  assert.equal(
    doc.querySelector('[aria-label="Already in box: 2025/two"]').disabled,
    true,
  );
  doc.querySelector('[aria-label="Add to box: 2026/infrared/one"]').click();
  assert.deepEqual(
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key),
    ["2025/two", "2026/infrared/one"],
  );
  assert.deepEqual(canvasOrder(doc), pagesBefore);
  doc.querySelector("#save").click();
  await tick();
  assert.deepEqual(requests[0].boxKeys, ["2025/two", "2026/infrared/one"]);
  assert.equal(requests[0].boxRevision, "box-original");
  assert.equal(requests[0].catalog.boxPhotos, undefined);
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
});
test("box ordering, removal, and page edits share undo and draft recovery", async (t) => {
  const { w, doc } = await editor(t);
  doc.querySelector("#box-view").click();
  doc.querySelector('[aria-label="Add to box: 2026/infrared/one"]').click();
  doc.querySelector('[aria-label="Make one first"]').click();
  assert.deepEqual(
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key),
    ["2026/infrared/one", "2025/two"],
  );
  const draft = JSON.parse(
    w.localStorage.getItem("photoportfolio-page-studio-v1"),
  );
  assert.deepEqual(draft.catalog.boxPhotos, ["2026/infrared/one", "2025/two"]);
  assert.equal(draft.boxRevision, "box-original");
  doc.querySelector('[aria-label="Remove one from box"]').click();
  assert.equal(doc.querySelectorAll(".box-card").length, 1);
  doc.querySelector("#undo").click();
  assert.deepEqual(
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key),
    ["2026/infrared/one", "2025/two"],
  );
  doc.querySelector("#undo").click();
  doc.querySelector("#undo").click();
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  doc.querySelector("#edit-view").click();
  assert.equal(canvasOrder(doc)[0][0], "One");
});
test("box bulk add honors library filters and deduplicates selected photos", async (t) => {
  const { doc, select, input } = await editor(t);
  doc.querySelector("#box-view").click();
  select("year", "2026");
  assert.equal(
    doc.querySelector("#box-add-filtered").textContent,
    "Add matching photos (1)",
  );
  doc.querySelector("#box-add-filtered").click();
  assert.equal(doc.querySelectorAll(".box-card").length, 2);
  assert.equal(doc.querySelector("#box-add-filtered").disabled, true);
  doc.querySelector("#undo").click();
  input(doc.querySelector("#search"), "no matches");
  assert.equal(doc.querySelector("#box-add-filtered").disabled, true);
});
test("box drag inserts on either side of cards and accepts library photos at the end", async (t) => {
  const { w, doc } = await editor(t);
  doc.querySelector("#box-view").click();
  const target = doc.querySelector(".box-card");
  target.getBoundingClientRect = () => ({ left: 100, width: 100 });
  let data = transfer();
  dragEvent(
    w,
    doc.querySelector('#library [draggable="true"]'),
    "dragstart",
    data,
  );
  dragEvent(w, target, "dragover", data, 110);
  assert.ok(target.classList.contains("box-drop-before"));
  dragEvent(w, target, "drop", data, 110);
  assert.deepEqual(
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key),
    ["2026/infrared/one", "2025/two"],
  );
  data = transfer();
  dragEvent(w, doc.querySelector(".box-photo"), "dragstart", data);
  dragEvent(w, doc.querySelector("#box-drop-end"), "drop", data, 300);
  assert.deepEqual(
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key),
    ["2025/two", "2026/infrared/one"],
  );
  assert.equal(
    doc.querySelector(".box-drop-before,.box-drop-after,.box-drag-source"),
    null,
  );
  doc.querySelector("#undo").click();
  assert.deepEqual(
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key),
    ["2026/infrared/one", "2025/two"],
  );
});

test("box position inputs commit complete numbers, renumber every card, and undo as one move", async (t) => {
  const { w, doc, input } = await editor(t, 694, "edit", movementFixture);
  doc.querySelector("#box-view").click();
  doc.querySelector("#box-add-filtered").click();
  const order = () =>
    [...doc.querySelectorAll(".box-card")].map((card) => card.dataset.key);
  const before = order();
  const field = doc.querySelector(".box-number");
  field.focus();
  input(field, "4");
  assert.deepEqual(order(), before);
  field.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(order()[3], before[0]);
  assert.deepEqual(
    [...doc.querySelectorAll(".box-number")].map((field) =>
      Number(field.value),
    ),
    before.map((_, i) => i + 1),
  );
  assert.equal(doc.activeElement.closest(".box-card").dataset.key, before[0]);
  assert.equal(doc.activeElement.value, "4");
  doc.querySelector("#undo").click();
  assert.deepEqual(order(), before);
  const last = doc.querySelector(".box-card:last-child .box-number");
  last.focus();
  input(last, "1");
  last.blur();
  assert.equal(order()[0], before.at(-1));
  doc.querySelector("#undo").click();
  assert.deepEqual(order(), before);
});
test("invalid and cancelled box position edits do not change the order or create undo steps", async (t) => {
  const { w, doc, input } = await editor(t);
  doc.querySelector("#box-view").click();
  const field = doc.querySelector(".box-number");
  for (const value of ["", "0", "2", "1.5"]) {
    field.focus();
    input(field, value);
    field.blur();
    assert.equal(field.value, "1");
    assert.equal(doc.querySelector("#undo").disabled, true);
  }
  field.focus();
  input(field, "9");
  field.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.equal(field.value, "1");
  assert.equal(doc.querySelector("#status").textContent, "Saved locally");
  assert.equal(doc.querySelector("#undo").disabled, true);
});
