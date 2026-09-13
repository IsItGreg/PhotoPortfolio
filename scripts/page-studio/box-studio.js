import { moveItem } from "./model.js";

export function createBoxStudio({
  h,
  button,
  thumb,
  read,
  update,
  notify,
  openPhoto,
  libraryDrag,
  endLibraryDrag,
}) {
  const root = document.getElementById("box-studio");
  let dragged = null;
  const keys = () => read().catalog.boxPhotos || [];
  const item = (key) => read().library.find((photo) => photo.key === key);
  const label = (key) => key.split("/").at(-1);
  const selected = (key) => keys().includes(key);
  function focus(key, action = "preview") {
    const card = [...root.querySelectorAll(".box-card")].find(
      (node) => node.dataset.key === key,
    );
    card
      ?.querySelector(`[data-action="${action}"]`)
      ?.focus({ preventScroll: true });
    if (action === "position")
      card?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
  function add(incoming, before = null) {
    const fresh = [...new Set(incoming)].filter((key) => !selected(key));
    if (keys().length + fresh.length > 600)
      return notify("The box can hold up to 600 photos.");
    if (!fresh.length) return;
    update((draft) => {
      const index =
        before === null
          ? draft.boxPhotos.length
          : draft.boxPhotos.indexOf(before);
      draft.boxPhotos.splice(
        index < 0 ? draft.boxPhotos.length : index,
        0,
        ...fresh,
      );
    });
    focus(fresh[0]);
  }
  function move(key, before) {
    if (key === before || !selected(key)) return;
    update((draft) => {
      draft.boxPhotos.splice(draft.boxPhotos.indexOf(key), 1);
      const index =
        before === null
          ? draft.boxPhotos.length
          : draft.boxPhotos.indexOf(before);
      draft.boxPhotos.splice(
        index < 0 ? draft.boxPhotos.length : index,
        0,
        key,
      );
    });
    focus(key);
  }
  function nudge(key, delta) {
    update((draft) =>
      moveItem(draft.boxPhotos, draft.boxPhotos.indexOf(key), delta),
    );
    focus(key);
  }
  function positionInput(key, index, count) {
    const commit = (keepFocus = false) => {
      const current = keys().indexOf(key);
      if (current < 0 || read().saving || !input.isConnected) return;
      const position = Number(input.value);
      if (
        !input.value.trim() ||
        !Number.isInteger(position) ||
        position < 1 ||
        position > keys().length
      ) {
        input.value = String(current + 1);
        notify(`Choose a whole-number position from 1 to ${keys().length}.`);
        return;
      }
      if (position === current + 1) return;
      update((draft) =>
        moveItem(draft.boxPhotos, current, position - 1 - current),
      );
      if (keepFocus) focus(key, "position");
    };
    const input = h("input", {
      className: "box-number",
      type: "number",
      inputMode: "numeric",
      min: 1,
      max: count,
      step: 1,
      value: index + 1,
      disabled: read().saving,
      "data-action": "position",
      "aria-label": `Position of ${key} in photo box`,
      title: `Position 1–${count}. Enter or leave the field to move; Escape cancels.`,
      onblur: () => commit(),
      onkeydown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          commit(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          input.value = String(keys().indexOf(key) + 1);
          input.blur();
        }
      },
    });
    return input;
  }
  function remove(key) {
    const index = keys().indexOf(key);
    update((draft) => {
      draft.boxPhotos = draft.boxPhotos.filter((value) => value !== key);
    });
    focus(keys()[Math.min(index, keys().length - 1)]);
  }
  function clearMarker() {
    root
      .querySelectorAll(".box-drop-before,.box-drop-after,.box-drop-active")
      .forEach((node) =>
        node.classList.remove(
          "box-drop-before",
          "box-drop-after",
          "box-drop-active",
        ),
      );
  }
  function clearDrag() {
    dragged = null;
    clearMarker();
    root
      .querySelectorAll(".box-drag-source")
      .forEach((node) => node.classList.remove("box-drag-source"));
  }
  function payload() {
    if (dragged) return { kind: "box", key: dragged };
    const external = libraryDrag();
    return external?.kind === "library" ? external : null;
  }
  function boundary(card, event) {
    if (!card) return null;
    const after =
      event.clientX >=
      card.getBoundingClientRect().left +
        card.getBoundingClientRect().width / 2;
    const index = keys().indexOf(card.dataset.key);
    return { before: keys()[index + (after ? 1 : 0)] ?? null, after };
  }
  function hover(event, card) {
    const source = payload();
    if (!source || read().saving) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = selected(source.key) ? "move" : "copy";
    clearMarker();
    if (card)
      card.classList.add(
        boundary(card, event).after ? "box-drop-after" : "box-drop-before",
      );
    else
      document.getElementById("box-drop-end").classList.add("box-drop-active");
  }
  function drop(event, card) {
    event.preventDefault();
    event.stopPropagation();
    const source = payload(),
      before = boundary(card, event)?.before ?? null;
    clearDrag();
    endLibraryDrag();
    if (!source || read().saving) return;
    if (selected(source.key)) move(source.key, before);
    else add([source.key], before);
  }
  function render() {
    clearDrag();
    if (read().mode !== "box") return;
    const photos = keys();
    root.replaceChildren(
      h(
        "header",
        { className: "box-heading" },
        h(
          "div",
          {},
          h("p", { className: "organizer-eyebrow" }, "Home page"),
          h("h2", {}, "Photo box"),
          h(
            "p",
            {},
            `${photos.length} ${
              photos.length === 1 ? "photo" : "photos"
            } · First photo on top, then left to right.`,
          ),
        ),
        h(
          "a",
          {
            href: "/preview#/",
            target: "_blank",
            rel: "noopener",
            className: "button-link",
          },
          "Preview saved box ↗",
        ),
      ),
      h(
        "p",
        { className: "box-help" },
        "Add photos from the library. Edit a position number, drag to reorder, or use the arrows. Save changes updates the box locally.",
      ),
      h(
        "div",
        { className: "box-actions" },
        button(
          "Add matching photos",
          () => add(read().filtered.map((photo) => photo.key)),
          { id: "box-add-filtered" },
        ),
        h("span", { id: "box-filter-note", className: "muted" }),
      ),
      h(
        "div",
        {
          className: "box-grid",
          role: "list",
          "aria-label": "Photos in box order",
        },
        ...photos.map((key, index) => {
          const photo = item(key)?.photo || {
            yearFilename: key,
            title: label(key),
          };
          const card = h("article", {
            className: "box-card",
            "data-key": key,
            role: "listitem",
          });
          const preview = button("", () => openPhoto(photo), {
            className: "box-photo",
            "data-action": "preview",
            "aria-label": `Preview box photo ${index + 1}: ${label(key)}`,
            draggable: !read().saving,
            ondragstart: (event) => {
              if (read().saving) return event.preventDefault();
              dragged = key;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(
                "application/x-page-studio",
                JSON.stringify({ kind: "box", key }),
              );
              card.classList.add("box-drag-source");
            },
            onkeydown: (event) => {
              if (
                event.altKey &&
                ["ArrowLeft", "ArrowRight"].includes(event.key)
              ) {
                event.preventDefault();
                nudge(key, event.key === "ArrowLeft" ? -1 : 1);
              }
            },
          });
          preview.append(
            h("img", {
              src: thumb(key),
              alt: photo.title,
              loading: "lazy",
              draggable: false,
            }),
          );
          card.append(
            h(
              "div",
              { className: "box-card-top" },
              positionInput(key, index, photos.length),
              index === 0
                ? h("span", { className: "box-first" }, "First photo")
                : button("Make first", () => move(key, keys()[0]), {
                    "aria-label": `Make ${label(key)} first`,
                  }),
            ),
            preview,
            h(
              "div",
              { className: "box-card-info" },
              h("strong", { title: key }, label(key)),
              h("span", {}, key.split("/").slice(0, -1).join(" / ")),
            ),
            h(
              "div",
              { className: "box-card-actions" },
              button("←", () => nudge(key, -1), {
                disabled: index === 0,
                "aria-label": `Move ${label(key)} earlier`,
              }),
              button("→", () => nudge(key, 1), {
                disabled: index === photos.length - 1,
                "aria-label": `Move ${label(key)} later`,
              }),
              button("Remove", () => remove(key), {
                className: "quiet-danger",
                "aria-label": `Remove ${label(key)} from box`,
              }),
            ),
          );
          card.ondragenter = card.ondragover = (event) => hover(event, card);
          card.ondragleave = (event) => {
            if (!card.contains(event.relatedTarget)) clearMarker();
          };
          card.ondrop = (event) => drop(event, card);
          return card;
        }),
      ),
      h(
        "div",
        {
          id: "box-drop-end",
          className: "box-drop-end",
          ondragenter: (event) => hover(event, null),
          ondragover: (event) => hover(event, null),
          ondragleave: clearMarker,
          ondrop: (event) => drop(event, null),
        },
        photos.length
          ? "Drop a photo here to put it last"
          : "Your box is empty. Add photos from the library or drop them here.",
      ),
      h(
        "p",
        { className: "box-help" },
        "Removing a photo from the box keeps it in the library and on its gallery pages. New box photos get the same white border as your existing prints.",
      ),
    );
    updateFilters();
  }
  function updateFilters() {
    const control = document.getElementById("box-add-filtered");
    if (!control) return;
    const count = read().filtered.filter(
      (photo) => !selected(photo.key),
    ).length;
    control.textContent = `Add matching photos${count ? ` (${count})` : ""}`;
    control.disabled = read().saving || !count;
    document.getElementById("box-filter-note").textContent =
      "Uses the library’s search, year, and folder filters.";
  }
  document.addEventListener("dragend", clearDrag);
  document.addEventListener("drop", clearDrag);
  window.addEventListener("blur", clearDrag);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearDrag();
  });
  return { render, add, selected, updateFilters, clearDrag };
}
