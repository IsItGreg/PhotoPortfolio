import { act, renderHook } from "@testing-library/react";
import {
  nearbyPhotoIndices,
  useRequestedPhotos,
  wrapPhotoIndex,
  PHOTO_BACKGROUND_DELAY_MS,
  PHOTO_BACKGROUND_BATCH_MS,
} from "./photoStackLoading";

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("initial download is only the top photo and its two neighbors", () => {
  expect(nearbyPhotoIndices(0, 18)).toEqual([0, 1, 17]);
  const { result } = renderHook(() => useRequestedPhotos(0, 18));
  expect(Array.from(result.current).sort((a, b) => a - b)).toEqual([0, 1, 17]);
});

test("forward browsing loads one new neighbor and retains the previous faces", () => {
  const { result, rerender } = renderHook(
    ({ index }) => useRequestedPhotos(index, 18),
    { initialProps: { index: 0 } },
  );
  rerender({ index: 1 });
  expect(Array.from(result.current).sort((a, b) => a - b)).toEqual([
    0, 1, 2, 17,
  ]);
  rerender({ index: 2 });
  expect(Array.from(result.current).sort((a, b) => a - b)).toEqual([
    0, 1, 2, 3, 17,
  ]);
});

test("backward navigation wraps, and tiny or empty stacks have no invalid requests", () => {
  expect(wrapPhotoIndex(-1, 18)).toBe(17);
  expect(wrapPhotoIndex(18, 18)).toBe(0);
  expect(wrapPhotoIndex(-1, 0)).toBe(0);
  expect(nearbyPhotoIndices(0, 0)).toEqual([]);
  expect(nearbyPhotoIndices(0, 1)).toEqual([0]);
  expect(nearbyPhotoIndices(0, 2)).toEqual([0, 1]);
  expect(nearbyPhotoIndices(17, 18)).toEqual([17, 0, 16]);
});

test("loading a manifest later or shrinking it cannot leave out-of-range indices", () => {
  const { result, rerender } = renderHook(
    ({ count }) => useRequestedPhotos(0, count),
    { initialProps: { count: 0 } },
  );
  expect(result.current.size).toBe(0);
  rerender({ count: 18 });
  expect(result.current.size).toBe(3);
  rerender({ count: 1 });
  expect(Array.from(result.current)).toEqual([0]);
});

test("remaining photos load shortly after the scene, in batches, without user interaction", () => {
  const { result } = renderHook(() => useRequestedPhotos(0, 18));
  expect(result.current.size).toBe(3);
  act(() => jest.advanceTimersByTime(PHOTO_BACKGROUND_DELAY_MS - 1));
  expect(result.current.size).toBe(3);
  act(() => jest.advanceTimersByTime(1));
  expect(result.current.size).toBe(6);
  act(() => jest.advanceTimersByTime(PHOTO_BACKGROUND_BATCH_MS));
  expect(result.current.size).toBe(9);
  act(() => jest.advanceTimersByTime(PHOTO_BACKGROUND_BATCH_MS * 3));
  expect(Array.from(result.current).sort((a, b) => a - b)).toEqual(
    Array.from({ length: 18 }, (_, index) => index),
  );
});

test("navigation does not postpone background loading and unmount cancels pending work", () => {
  const { result, rerender, unmount } = renderHook(
    ({ index }) => useRequestedPhotos(index, 18),
    { initialProps: { index: 0 } },
  );
  act(() => jest.advanceTimersByTime(PHOTO_BACKGROUND_DELAY_MS - 100));
  rerender({ index: 1 });
  act(() => jest.advanceTimersByTime(100));
  expect(result.current.size).toBe(7); // four immediate neighbors plus three background
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
