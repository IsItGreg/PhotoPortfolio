import {
  pagesForGallery,
  galleriesForPage,
  photoCount,
  moveItem,
  attachPage,
  detachPage,
} from "./model.js";

// Organization uses the editor's draft and update transaction so every action
// participates in its undo, recovery, and save behavior.
export function createOrganizer({
  h,
  button,
  thumb,
  read,
  update,
  notify,
  navigate,
  editPage,
  newPage,
  addExisting,
}) {
  const $ = (id) => document.getElementById(id);
  let selected = new Set();
  let layout = "board";
  let membershipIds = [];
  let membershipMode = "edit";
  try {
    layout =
      localStorage.getItem("photoportfolio-page-studio-layout") === "list"
        ? "list"
        : "board";
  } catch {
    /* Optional preference. */
  }
  const currentPages = () =>
    read().gallery
      ? pagesForGallery(read().catalog, read().gallery)
      : read().catalog.pages;
  const blocked = () => read().saving || read().preview;
  const act = (label, action, attrs = {}) =>
    button(label, action, { disabled: blocked(), ...attrs });
  const visibility = (item, kind) =>
    h(
      "div",
      { className: "visibility-setting" },
      h("span", { className: "setting-label" }, kind + " visibility"),
      h(
        "div",
        {
          className: "segmented",
          role: "group",
          "aria-label": kind + " visibility",
        },
        ...[true, false].map((value) =>
          act(
            value ? "Visible" : "Hidden",
            () =>
              update(() => {
                item.visible = value;
              }),
            {
              "aria-pressed": String(item.visible === value),
            },
          ),
        ),
      ),
    );
  function miniature(p) {
    const node = h(
      "div",
      { className: "mini-page" },
      ...p.rows
        .filter((row) => row.length)
        .map((row) =>
          h(
            "div",
            { className: "mini-row" },
            ...row.map((photo) =>
              h("img", {
                src: thumb(photo.yearFilename),
                alt: "",
                loading: "lazy",
                draggable: false,
                style: {
                  flexGrow:
                    photo.aspect === "vertical"
                      ? "0.67"
                      : photo.aspect === "square"
                        ? "1"
                        : "1.5",
                },
              }),
            ),
          ),
        ),
    );
    if (!p.rows.some((row) => row.length))
      node.append(h("span", { className: "blank-label" }, "Blank page"));
    return node;
  }
  function moveGallery(id, targetId) {
    update(() => {
      const { catalog } = read();
      const index = catalog.galleries.findIndex((g) => g.id === id);
      const target = catalog.galleries.findIndex((g) => g.id === targetId);
      if (index < 0 || target < 0) return;
      const activeId = read().gallery?.id;
      moveItem(catalog.galleries, index, target - index);
      navigate(activeId, { refresh: false, keepMode: true });
    });
  }
  function movePage(id, targetId) {
    update(() => {
      const { catalog, gallery } = read();
      const list = gallery ? gallery.pageIds : catalog.pages;
      const ids = list.map((p) => (typeof p === "string" ? p : p.id));
      const index = ids.indexOf(id),
        target = ids.indexOf(targetId);
      if (index < 0 || target < 0) return;
      moveItem(list, index, target - index);
      editPage(id, { refresh: false, keepMode: true });
    });
  }
  function dragStart(event, kind, id) {
    if (blocked()) return event.preventDefault();
    event.dataTransfer.setData(
      "application/x-page-studio",
      JSON.stringify({ kind, id, galleryId: read().gallery?.id ?? null }),
    );
    event.dataTransfer.effectAllowed = "move";
  }
  function receiveDrop(event, kind, targetId) {
    event.preventDefault();
    if (blocked()) return;
    try {
      const payload = JSON.parse(
        event.dataTransfer.getData("application/x-page-studio"),
      );
      if (payload.kind !== kind) return;
      if (kind === "organizer-gallery") moveGallery(payload.id, targetId);
      else if (payload.galleryId === (read().gallery?.id ?? null))
        movePage(payload.id, targetId);
    } catch {
      /* Ignore unrelated drags. */
    }
  }
  function renderNav() {
    const { catalog, gallery } = read();
    $("gallery-nav").replaceChildren(
      act("", () => navigate(null), {
        className: "gallery-nav-item",
        "aria-current": gallery ? "false" : "page",
      }),
      h("p", { className: "nav-label" }, "Galleries · menu order"),
      ...catalog.galleries.map((g, i) => {
        const shown = pagesForGallery(catalog, g).filter(
          (p) => p.visible,
        ).length;
        const node = act("", () => navigate(g.id), {
          className: "gallery-nav-item",
          "aria-current": gallery?.id === g.id ? "page" : "false",
          "data-gallery-id": g.id,
          draggable: !blocked(),
          ondragstart: (e) => dragStart(e, "organizer-gallery", g.id),
          ondragover: (e) => {
            if (!blocked()) e.preventDefault();
          },
          ondrop: (e) => receiveDrop(e, "organizer-gallery", g.id),
        });
        node.append(
          h(
            "span",
            { className: "nav-position", "aria-hidden": "true" },
            String(i + 1),
          ),
          h(
            "span",
            { className: "nav-copy" },
            h("strong", {}, g.title),
            h(
              "small",
              {},
              `${g.pageIds.length} ${
                g.pageIds.length === 1 ? "page" : "pages"
              } · ${g.visible ? shown + " visible" : "gallery hidden"}`,
            ),
          ),
        );
        return node;
      }),
    );
    $("gallery-nav").firstElementChild.append(
      h("span", { className: "nav-copy" }, h("strong", {}, "All pages")),
      h("span", {}, String(catalog.pages.length)),
    );
  }
  function bulkVisibility(value) {
    update(() =>
      read().catalog.pages.forEach((p) => {
        if (selected.has(p.id)) p.visible = value;
      }),
    );
  }
  function card(p, index, list) {
    const { catalog, gallery } = read();
    const select = h("input", {
      id: "organize-select-" + p.id,
      type: "checkbox",
      checked: selected.has(p.id),
      disabled: blocked(),
      "aria-label": "Select " + p.title,
      onchange: (e) => {
        if (e.target.checked) selected.add(p.id);
        else selected.delete(p.id);
        render();
        $("organize-select-" + p.id)?.focus({ preventScroll: true });
      },
    });
    const open = act("", () => editPage(p.id), {
      className: "organizer-page-open",
      "aria-label": "Edit " + p.title,
    });
    open.append(miniature(p));
    const uses = galleriesForPage(catalog, p.id);
    const position = h(
      "div",
      { className: "organizer-page-top" },
      h(
        "label",
        { className: "page-check" },
        select,
        h("span", {}, String(index + 1).padStart(2, "0")),
      ),
      h(
        "div",
        { className: "organizer-order" },
        act("←", () => movePage(p.id, list[index - 1].id), {
          disabled: blocked() || index === 0,
          "aria-label": "Move " + p.title + " earlier",
        }),
        act("→", () => movePage(p.id, list[index + 1].id), {
          disabled: blocked() || index === list.length - 1,
          "aria-label": "Move " + p.title + " later",
        }),
      ),
    );
    return h(
      "article",
      {
        className: "organizer-page" + (selected.has(p.id) ? " selected" : ""),
        "data-page-id": p.id,
        draggable: !blocked(),
        ondragstart: (e) => dragStart(e, "organizer-page", p.id),
        ondragover: (e) => {
          if (!blocked()) e.preventDefault();
        },
        ondrop: (e) => receiveDrop(e, "organizer-page", p.id),
      },
      position,
      open,
      h(
        "div",
        { className: "organizer-page-info" },
        act(p.title, () => editPage(p.id), {
          className: "organizer-page-title",
        }),
        h(
          "p",
          { className: "organizer-page-meta" },
          `${photoCount([p])} photos`,
        ),
        !gallery || uses.length > 1
          ? h(
              "p",
              { className: "organizer-page-meta" },
              uses.length ? uses.map((g) => g.title).join(" · ") : "No gallery",
            )
          : null,
      ),
      h(
        "div",
        { className: "organizer-page-state" },
        h(
          "span",
          { className: "visibility-state" + (p.visible ? " visible" : "") },
          p.visible ? "Visible" : "Hidden",
        ),
        act(
          p.visible ? "Hide" : "Show",
          () =>
            update(() => {
              p.visible = !p.visible;
            }),
          {
            className: "text-button",
            "aria-label": `${p.visible ? "Hide" : "Show"} ${p.title} on site`,
            title: "Applies wherever this page is included",
          },
        ),
      ),
    );
  }
  function render() {
    const { gallery, mode } = read();
    const list = currentPages();
    selected = new Set(
      [...selected].filter((id) => list.some((p) => p.id === id)),
    );
    if (mode !== "organize") return;
    const shown = list.filter((p) => p.visible).length;
    const heading = h(
      "div",
      { className: "organizer-heading" },
      h(
        "div",
        {},
        h(
          "p",
          { className: "organizer-eyebrow" },
          gallery ? "Gallery" : "Page library",
        ),
        h("h2", {}, gallery?.title || "All pages"),
        h(
          "p",
          { className: "organizer-summary" },
          `${list.length} ${
            list.length === 1 ? "page" : "pages"
          } · ${shown} visible · ${list.length - shown} hidden`,
        ),
      ),
      gallery ? visibility(gallery, "Gallery") : null,
    );
    let notice = null;
    if (gallery && !gallery.visible)
      notice = h(
        "div",
        { className: "organizer-notice" },
        h(
          "span",
          {},
          "This gallery is hidden from the site. Its pages keep their own visibility settings.",
        ),
        act("Show gallery", () =>
          update(() => {
            gallery.visible = true;
          }),
        ),
      );
    else if (gallery && !shown)
      notice = h(
        "div",
        { className: "organizer-notice" },
        h(
          "span",
          {},
          list.length
            ? `This gallery won’t appear on the site yet. All ${list.length} ${
                list.length === 1 ? "page is" : "pages are"
              } hidden.`
            : "Add a visible page for this gallery to appear on the site.",
        ),
        list.length
          ? act("Show all pages", () =>
              update(() =>
                list.forEach((p) => {
                  p.visible = true;
                }),
              ),
            )
          : null,
      );
    const controls = h(
      "div",
      { className: "organizer-toolbar" },
      h(
        "div",
        {},
        h("h3", {}, gallery ? "Page order" : "Your pages"),
        h(
          "p",
          {},
          gallery
            ? "Drag pages to rearrange the gallery."
            : "Pages can belong to several galleries.",
        ),
      ),
      h(
        "div",
        { className: "organizer-actions" },
        h(
          "div",
          {
            className: "segmented",
            role: "group",
            "aria-label": "Page layout",
          },
          ...["board", "list"].map((value) =>
            button(
              value === "board" ? "Board" : "List",
              () => {
                layout = value;
                try {
                  localStorage.setItem(
                    "photoportfolio-page-studio-layout",
                    layout,
                  );
                } catch {
                  /* Optional preference. */
                }
                render();
              },
              { "aria-pressed": String(layout === value) },
            ),
          ),
        ),
        gallery ? act("Add pages", addExisting) : null,
        act("New page", newPage),
      ),
    );
    const bulk = selected.size
      ? h(
          "div",
          { className: "bulk-actions", "aria-label": "Selected page actions" },
          h("strong", {}, `${selected.size} selected`),
          act("Show on site", () => bulkVisibility(true)),
          act("Hide", () => bulkVisibility(false)),
          act("Add to gallery", () => openMembership([...selected], "add")),
          gallery
            ? act("Remove from gallery", () => {
                update(() => {
                  selected.forEach((id) =>
                    detachPage(read().catalog, gallery.id, id),
                  );
                });
                notify(
                  "Removed from this gallery. The pages remain in All pages. Undo restores their membership.",
                );
              })
            : null,
          button("Clear", () => {
            selected.clear();
            render();
          }),
        )
      : null;
    $("organizer").replaceChildren(
      heading,
      ...[notice, controls, bulk].filter(Boolean),
      h(
        "div",
        {
          className: "organizer-pages " + layout,
          "aria-label": "Pages in order",
        },
        ...list.map((p, i) => card(p, i, list)),
      ),
      !list.length
        ? h(
            "div",
            { className: "organizer-empty" },
            h(
              "h3",
              {},
              gallery
                ? "Start with pages from your library"
                : "Create your first page",
            ),
            h(
              "p",
              {},
              gallery
                ? "Add an existing page, or start a new one here."
                : "New pages start Hidden while you arrange your photos.",
            ),
          )
        : h(
            "p",
            { className: "organizer-footnote" },
            "Open a page to edit its photos. Visibility and layout are shared wherever the page is included.",
          ),
    );
  }
  function renderPageSettings() {
    const { catalog, page } = read();
    if (!page) return;
    const uses = galleriesForPage(catalog, page.id);
    const destinations = uses.filter((g) => g.visible);
    $("page-visibility").replaceChildren(visibility(page, "Page"));
    $("page-site-status").textContent = !page.visible
      ? "Hidden from the site. Available in All pages."
      : destinations.length
        ? "After saving, visible in: " +
          destinations.map((g) => g.title).join(", ") +
          "."
        : "Not on the site yet: include this page in a visible gallery.";
    $("page-membership").textContent =
      "Included in: " +
      (uses.length ? uses.map((g) => g.title).join(", ") : "no galleries") +
      ". Visibility and layout are shared.";
  }
  function openMembership(ids, mode = "edit") {
    if (blocked()) return;
    const { catalog } = read();
    membershipIds = ids.filter((id) => catalog.pages.some((p) => p.id === id));
    if (!membershipIds.length) return;
    membershipMode = mode;
    $("membership-heading").textContent =
      mode === "add"
        ? "Add selected pages to galleries"
        : "Included in galleries";
    $("membership-help").textContent =
      mode === "add"
        ? "Add the same pages without making copies. Existing memberships stay in place."
        : "Select the galleries that include this page. Removing a membership keeps the page in All pages.";
    $("membership-error").textContent = "";
    $("membership-list").replaceChildren(
      ...catalog.galleries.map((g) =>
        h(
          "label",
          { className: "attach-card" },
          h("input", {
            type: "checkbox",
            name: "membership",
            value: g.id,
            checked: mode === "edit" && g.pageIds.includes(membershipIds[0]),
            onchange: renderMembershipCount,
          }),
          h(
            "span",
            {},
            h("strong", {}, g.title),
            h("small", {}, g.visible ? "Visible gallery" : "Hidden gallery"),
          ),
        ),
      ),
    );
    if (!catalog.galleries.length)
      $("membership-list").append(
        h("p", {}, "Create a gallery first using New gallery."),
      );
    renderMembershipCount();
    $("membership-dialog").showModal();
  }
  function renderMembershipCount() {
    $("membership-submit").disabled =
      membershipMode === "add" &&
      !document.querySelector('input[name="membership"]:checked');
    $("membership-submit").textContent =
      membershipMode === "add" ? "Add to galleries" : "Apply membership";
  }
  $("membership-cancel").onclick = () => $("membership-dialog").close();
  $("membership-form").onsubmit = (e) => {
    e.preventDefault();
    if (blocked()) return;
    const { catalog } = read();
    const targets = new Set(
      [...document.querySelectorAll('input[name="membership"]:checked')].map(
        (input) => input.value,
      ),
    );
    if (membershipMode === "add" && !targets.size) return;
    if (
      catalog.galleries.some(
        (g) =>
          targets.has(g.id) &&
          g.pageIds.length +
            membershipIds.filter((id) => !g.pageIds.includes(id)).length >
            200,
      )
    ) {
      $("membership-error").textContent =
        "A gallery can contain at most 200 pages. Choose another gallery.";
      return;
    }
    update(() => {
      const activePageId = read().page?.id;
      catalog.galleries.forEach((g) =>
        membershipIds.forEach((id) => {
          if (targets.has(g.id)) attachPage(catalog, g.id, id);
          else if (membershipMode === "edit") detachPage(catalog, g.id, id);
        }),
      );
      if (
        membershipMode === "edit" &&
        activePageId &&
        read().gallery &&
        !read().gallery.pageIds.includes(activePageId)
      ) {
        navigate(null, { refresh: false, keepMode: true });
        editPage(activePageId, { refresh: false, keepMode: true });
      }
    });
    $("membership-dialog").close();
  };
  return {
    render,
    renderNav,
    renderPageSettings,
    openMembership,
    moveGallery,
    selectedIds: () => [...selected],
    restoreSelection: (ids) => {
      selected = new Set(ids || []);
    },
    clearSelection: () => selected.clear(),
  };
}
