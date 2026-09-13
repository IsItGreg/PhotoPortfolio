import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { Gallery } from "./galleryCatalog";

let mockSceneReady = false;
let mockResolveScene: () => void;
let mockScenePending: Promise<void>;
let mockGalleries: Gallery[];
let mockGalleryStatus: "loading" | "ready" | "error";

jest.mock("./ThreeDim/ThreeDim", () => ({
  ThreeDim: () => {
    if (!mockSceneReady) throw mockScenePending;
    return <div>Box scene ready</div>;
  },
}));

jest.mock("./pageGalleries", () => ({
  PageGalleryProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  usePageGalleries: () => mockGalleries,
  useGalleryStatus: () => mockGalleryStatus,
}));

jest.mock("./photoAssets", () => ({
  PhotoAssetProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("./TwoDim/TwoDimPage", () => ({
  TwoDimPage: () => <div>NYC gallery ready</div>,
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/#/");
  mockGalleries = [{ id: "nyc", slug: "nyc", title: "NYC", pages: [] }];
  mockGalleryStatus = "ready";
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
  expect(
    screen.queryByText(/Loading the box of photos/),
  ).not.toBeInTheDocument();

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

test("a direct gallery visit keeps the header and open About dialog while its catalog loads", async () => {
  window.history.replaceState(null, "", "/#/nyc");
  mockGalleries = [];
  mockGalleryStatus = "loading";
  const { rerender } = render(<App />);
  const headerName = screen.getByText("Gregory Smelkov");

  expect(headerName).toBeVisible();
  expect(screen.getByRole("link", { name: "Box of photos" })).toBeVisible();
  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  expect(
    screen.queryByText("This gallery is unavailable."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "ABOUT" }));

  mockGalleries = [{ id: "nyc", slug: "nyc", title: "NYC", pages: [] }];
  mockGalleryStatus = "ready";
  rerender(<App />);

  expect(await screen.findByText("NYC gallery ready")).toBeVisible();
  expect(screen.getByText("Gregory Smelkov")).toBe(headerName);
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.queryByText("Loading galleries…")).not.toBeInTheDocument();
});

test("a failed gallery catalog keeps navigation available to return home", async () => {
  window.history.replaceState(null, "", "/#/nyc");
  mockGalleries = [];
  mockGalleryStatus = "error";
  render(<App />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "Galleries could not be loaded",
  );
  expect(screen.getByText("Gregory Smelkov")).toBeVisible();
  fireEvent.click(screen.getByRole("link", { name: "Box of photos" }));
  expect(screen.getByRole("button", { name: "ABOUT" })).toBeVisible();
  expect(
    screen.queryByText(/Galleries could not be loaded/),
  ).not.toBeInTheDocument();
});
