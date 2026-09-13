import { act, fireEvent, render, screen } from "@testing-library/react";
import { FullScreenImage } from "./FullScreenImage";
import { GalleryImage } from "./GalleryImage";

jest.mock("../photoAssets", () => ({
  usePhotoAsset: (key: string) => {
    const prefix = key === "2026/photo" ? "" : `/${key}`;
    const portrait = key === "2026/portrait";
    return {
      ready: true,
      smallSrc: `${prefix}/small.webp`,
      fullSrc: `${prefix}/full.jpg`,
      srcSet: `${prefix}/small.webp 480w, ${prefix}/full.jpg 3200w`,
      asset:
        key === "2026/missing-metadata"
          ? undefined
          : {
              width: portrait ? 2000 : 3000,
              height: portrait ? 3000 : 2000,
              placeholder: "data:image/webp;base64,preview",
            },
    };
  },
}));

const photo = {
  yearFilename: "2026/photo",
  title: "Trees",
  location: "",
  date: "",
};

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1280,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 720,
  });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 400,
    height: 250,
    top: 0,
    left: 0,
    bottom: 250,
    right: 400,
    x: 0,
    y: 0,
    toJSON() {},
  });
});

test("offscreen photos have no image request until their panel approaches", () => {
  const { container, rerender } = render(
    <GalleryImage photo={photo} active={false} onOpen={jest.fn()} />,
  );
  expect(container.querySelector("img")).toBeNull();
  rerender(<GalleryImage photo={photo} active={true} onOpen={jest.fn()} />);
  expect(screen.getByAltText("Trees")).toHaveAttribute("sizes", "400px");
  expect(screen.getByAltText("Trees")).toHaveAttribute(
    "srcset",
    "/small.webp 480w, /full.jpg 3200w",
  );
});

test("fullscreen keeps the already downloaded preview through a slow or failed image load", () => {
  render(
    <FullScreenImage
      image={photo}
      preview="/already-loaded.webp"
      index={0}
      total={2}
      onClose={jest.fn()}
      prevImg={jest.fn()}
      nextImg={jest.fn()}
    />,
  );
  expect(
    screen.getByRole("dialog").querySelector('img[aria-hidden="true"]'),
  ).toHaveAttribute("src", "/already-loaded.webp");
  const large = screen.getByAltText("Trees");
  expect(large).toHaveClass("opacity-0");
  fireEvent.error(large);
  fireEvent.click(
    screen.getByRole("button", { name: /Larger photo unavailable/ }),
  );
  const retried = screen.getByAltText("Trees");
  expect(retried).not.toBe(large);
  fireEvent.load(retried);
  expect(retried).toHaveClass("opacity-100");
  expect(
    screen.getByRole("dialog").querySelector('img[aria-hidden="true"]'),
  ).toHaveAttribute("src", "/already-loaded.webp");
});

test("fullscreen supports Escape and arrow navigation with bounded buttons", () => {
  const close = jest.fn(),
    next = jest.fn();
  render(
    <FullScreenImage
      image={photo}
      index={0}
      total={2}
      onClose={close}
      prevImg={jest.fn()}
      nextImg={next}
    />,
  );
  expect(screen.getByRole("button", { name: "PREV" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
  expect(next).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(close).toHaveBeenCalledTimes(1);
});

const previousPhoto = {
  ...photo,
  yearFilename: "2026/portrait",
  title: "Portrait",
};
const nextPhoto = {
  ...photo,
  yearFilename: "2026/landscape",
  title: "Landscape",
};
const viewerProps = {
  image: photo,
  index: 1,
  total: 3,
  previousPhoto,
  nextPhoto,
  onClose: jest.fn(),
  prevImg: jest.fn(),
  nextImg: jest.fn(),
};
const preloads = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLImageElement>("img[data-carousel-preload]"),
  );

test("waits for the current photo, then warms exactly its two neighbors at their own display sizes", () => {
  const { container, unmount } = render(<FullScreenImage {...viewerProps} />);
  expect(preloads(container)).toHaveLength(0);
  fireEvent.load(screen.getByAltText("Trees"));
  const images = preloads(container);
  expect(images.map((img) => img.dataset.carouselPreload)).toEqual([
    "2026/landscape",
    "2026/portrait",
  ]);
  expect(images[0]).toHaveAttribute("sizes", "936px");
  expect(images[1]).toHaveAttribute("sizes", "416px");
  expect(images[0]).toHaveAttribute(
    "srcset",
    "/2026/landscape/small.webp 480w, /2026/landscape/full.jpg 3200w",
  );
  for (const img of images) {
    expect(img).not.toBeVisible();
    expect(img).toHaveAttribute("fetchpriority", "low");
    expect(img).toHaveAttribute("loading", "eager");
  }
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 390,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 844,
  });
  fireEvent(window, new Event("resize"));
  expect(preloads(container).map((img) => img.sizes)).toEqual([
    "371px",
    "371px",
  ]);
  unmount();
  expect(preloads(container)).toHaveLength(0);
});

test("does not wrap past carousel ends or preload duplicate/current photos", () => {
  const { container, rerender } = render(
    <FullScreenImage {...viewerProps} index={0} />,
  );
  fireEvent.load(screen.getByAltText("Trees"));
  expect(preloads(container).map((img) => img.dataset.carouselPreload)).toEqual(
    [nextPhoto.yearFilename],
  );
  rerender(<FullScreenImage key="last" {...viewerProps} index={2} />);
  fireEvent.load(screen.getByAltText("Trees"));
  expect(preloads(container).map((img) => img.dataset.carouselPreload)).toEqual(
    [previousPhoto.yearFilename],
  );
  rerender(
    <FullScreenImage
      key="duplicate"
      {...viewerProps}
      nextPhoto={previousPhoto}
    />,
  );
  fireEvent.load(screen.getByAltText("Trees"));
  expect(preloads(container)).toHaveLength(1);
  rerender(
    <FullScreenImage
      key="current"
      {...viewerProps}
      previousPhoto={photo}
      nextPhoto={photo}
    />,
  );
  fireEvent.load(screen.getByAltText("Trees"));
  expect(preloads(container)).toHaveLength(0);
});

test("failed preloading does not affect the current photo, and unavailable metadata does not trigger a large fallback download", async () => {
  const { container } = render(
    <FullScreenImage
      {...viewerProps}
      previousPhoto={{ ...photo, yearFilename: "2026/missing-metadata" }}
    />,
  );
  fireEvent.error(screen.getByAltText("Trees"));
  expect(preloads(container)).toHaveLength(0);
  fireEvent.click(
    screen.getByRole("button", { name: /Larger photo unavailable/ }),
  );
  fireEvent.load(screen.getByAltText("Trees"));
  expect(preloads(container)).toHaveLength(1);
  const preload = preloads(container)[0];
  preload.decode = jest.fn().mockRejectedValue(new Error("Decode interrupted"));
  await act(async () => {
    fireEvent.load(preload);
  });
  fireEvent.error(preload);
  expect(screen.getByAltText("Trees")).toHaveClass("opacity-100");
  expect(
    screen.queryByRole("button", { name: /Larger photo unavailable/ }),
  ).toBeNull();
});
