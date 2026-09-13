import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

let mockSceneReady = false;
let mockResolveScene: () => void;
let mockScenePending: Promise<void>;

jest.mock("./ThreeDim/ThreeDim", () => ({
  ThreeDim: () => {
    if (!mockSceneReady) throw mockScenePending;
    return <div>Box scene ready</div>;
  },
}));

jest.mock("./pageGalleries", () => ({
  PageGalleryProvider: ({ children }: { children: React.ReactNode }) => children,
  usePageGalleries: () => [
    { id: "nyc", slug: "nyc", title: "NYC", pages: [] },
  ],
  useGalleryStatus: () => "ready",
}));

jest.mock("./photoAssets", () => ({
  PhotoAssetProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("./TwoDim/TwoDimPage", () => ({
  TwoDimPage: () => <div>NYC gallery ready</div>,
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/#/");
  mockSceneReady = false;
  mockScenePending = new Promise((resolve) => {
    mockResolveScene = resolve;
  });
});

test("header and gallery navigation remain usable while the box is loading", async () => {
  render(<App />);

  expect(await screen.findByText("Gregory Smelkov")).toBeVisible();
  expect(screen.getByRole("link", { name: "Box of photos" })).toBeVisible();
  expect(screen.getByRole("button", { name: "ABOUT" })).toBeVisible();
  expect(screen.queryByText("Box scene ready")).not.toBeInTheDocument();
  expect(screen.queryByText(/Loading the box of photos/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("link", { name: "NYC" }));
  expect(await screen.findByText("NYC gallery ready")).toBeVisible();
});

test("finishing the box load preserves an open About dialog", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "ABOUT" }));
  expect(screen.getByRole("dialog")).toBeVisible();

  await act(async () => {
    mockSceneReady = true;
    mockResolveScene();
    await mockScenePending;
  });

  expect(await screen.findByText("Box scene ready")).toBeVisible();
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getAllByText("Gregory Smelkov")).toHaveLength(1);
});
