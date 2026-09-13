import { Suspense } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as THREE from "three";
import { PhotoStack } from "./PhotoCard";
import {
  PHOTO_BACKGROUND_DELAY_MS,
  PHOTO_BACKGROUND_BATCH_MS,
} from "./photoStackLoading";

const mockScroll = {
  offset: 1,
  el: { scrollTo: jest.fn(), scrollHeight: 1000 },
};
let mockPendingUrl = "";
let mockFailedUrl = "";
const mockPending = new Promise(() => {});

jest.mock("@react-three/fiber", () => ({ useFrame: () => {} }));
jest.mock("@react-three/drei", () => ({
  useScroll: () => mockScroll,
  Outlines: () => null,
  Image: ({ url }: { url: string }) => {
    if (url === mockPendingUrl) throw mockPending;
    if (url === mockFailedUrl) throw new Error("Test photo unavailable");
    return <img alt={url} src={url} />;
  },
}));

const manifest = Array.from({ length: 18 }, (_, i) => ({
  url: `/photo-${i}.webp`,
  aspectRatio: 1.5,
  vertical: false,
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockPendingUrl = "";
  mockFailedUrl = "";
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => manifest });
  // React DOM is only a harness here, not a Three renderer. Ignore its expected
  // unknown-intrinsic warnings and the deliberately triggered error boundary.
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function scene() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <Suspense fallback={<p>Entire scene hidden</p>}>
        <p>Box stays visible</p>
        <PhotoStack position={new THREE.Vector3(0, 0.1, 0)} />
      </Suspense>,
    );
  });
  return result!;
}

test("all card positions exist but only three photo faces load initially", async () => {
  const { container } = await scene();
  await screen.findByAltText("/photo-17.webp");
  expect(screen.getAllByRole("img")).toHaveLength(3);
  expect(container.querySelectorAll("group > group")).toHaveLength(18);
  fireEvent.keyDown(document.body, { key: "ArrowRight", code: "ArrowRight" });
  await screen.findByAltText("/photo-15.webp");
  expect(screen.getAllByRole("img")).toHaveLength(4);
  fireEvent.keyDown(document.body, { key: "ArrowLeft", code: "ArrowLeft" });
  expect(screen.getAllByRole("img")).toHaveLength(4);
});

test("a suspended photo never takes the box or other photos off screen", async () => {
  mockPendingUrl = "/photo-16.webp";
  await scene();
  await screen.findByAltText("/photo-17.webp");
  expect(screen.getByText("Box stays visible")).toBeVisible();
  expect(screen.queryByText("Entire scene hidden")).toBeNull();
  expect(screen.getAllByRole("img")).toHaveLength(2);
});

test("a failed photo retains its paper placeholder and does not crash the scene", async () => {
  mockFailedUrl = "/photo-16.webp";
  const { container } = await scene();
  await screen.findByAltText("/photo-17.webp");
  expect(screen.getByText("Box stays visible")).toBeVisible();
  expect(container.querySelectorAll("group > group")).toHaveLength(18);
  expect(screen.getAllByRole("img")).toHaveLength(2);
});

test("a pointer click advances exactly once and does not reach objects behind the stack", async () => {
  const behindClick = jest.fn();
  let container: HTMLElement;
  await act(async () => {
    ({ container } = render(
      <div onClick={behindClick}>
        <PhotoStack position={new THREE.Vector3(0, 0.1, 0)} />
      </div>,
    ));
  });
  fireEvent.click(screen.getByAltText("/photo-17.webp"));
  expect(behindClick).not.toHaveBeenCalled();
  expect(screen.getAllByRole("img")).toHaveLength(4);
  expect(screen.getByAltText("/photo-15.webp")).toBeInTheDocument();
  expect(container!.querySelectorAll("group > group")).toHaveLength(18);
});

test("background-loaded faces cannot hide the box while a photo remains slow", async () => {
  mockPendingUrl = "/photo-15.webp";
  await scene();
  await act(async () => {
    jest.advanceTimersByTime(
      PHOTO_BACKGROUND_DELAY_MS + PHOTO_BACKGROUND_BATCH_MS * 4,
    );
  });
  expect(screen.getAllByRole("img")).toHaveLength(17);
  expect(screen.getByText("Box stays visible")).toBeVisible();
  expect(screen.queryByText("Entire scene hidden")).toBeNull();
});
