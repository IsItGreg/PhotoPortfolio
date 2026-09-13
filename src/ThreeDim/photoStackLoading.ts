import { useEffect, useState } from "react";

export const PHOTO_BACKGROUND_DELAY_MS = 600;
export const PHOTO_BACKGROUND_BATCH_MS = 150;
export const PHOTO_BACKGROUND_BATCH_SIZE = 3;

export function wrapPhotoIndex(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}

// Give the first photo and both navigation directions a head start.
export function nearbyPhotoIndices(index: number, count: number): number[] {
  if (count < 1) return [];
  return Array.from(
    new Set([0, 1, -1].map((step) => wrapPhotoIndex(index + step, count))),
  );
}

export function useRequestedPhotos(index: number, count: number): Set<number> {
  const [requested, setRequested] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    setRequested((previous) => {
      const next = new Set(
        Array.from(previous).filter((value) => value < count),
      );
      nearbyPhotoIndices(index, count).forEach((value) => next.add(value));
      return next;
    });
  }, [index, count]);
  useEffect(() => {
    // PhotoStack mounts with the ready scene, so this starts after the box can
    // appear. Stagger the remaining faces to spread out decode / GPU uploads.
    // Index changes must not restart the delay while someone is browsing.
    const batches = Math.ceil(
      Math.max(0, count - 3) / PHOTO_BACKGROUND_BATCH_SIZE,
    );
    const timers = Array.from({ length: batches }, (_, batch) =>
      window.setTimeout(
        () => {
          setRequested((previous) => {
            const next = new Set(previous);
            let added = 0;
            for (
              let value = 0;
              value < count && added < PHOTO_BACKGROUND_BATCH_SIZE;
              value++
            ) {
              if (!next.has(value)) {
                next.add(value);
                added += 1;
              }
            }
            return added ? next : previous;
          });
        },
        PHOTO_BACKGROUND_DELAY_MS + batch * PHOTO_BACKGROUND_BATCH_MS,
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [count]);
  // Include neighbors immediately; remember visited cards so their faces never
  // disappear as they move to the back. Background loading finishes the stack
  // even if the visitor has not clicked or scrolled yet.
  return new Set([
    ...Array.from(requested),
    ...nearbyPhotoIndices(index, count),
  ]);
}
