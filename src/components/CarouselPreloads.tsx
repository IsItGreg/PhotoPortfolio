import { useEffect, useState } from "react";
import { Photo } from "../photos";
import { usePhotoAsset } from "../photoAssets";

export const FULLSCREEN_VERTICAL_GAP = 96;
export const FULLSCREEN_VIEWPORT_WIDTH = 0.95;

// Match the visible fullscreen frame, including each neighbor's own aspect
// ratio. The browser applies pixel density when choosing from the same srcset.
export const fullscreenPhotoWidth = (
  ratio: number,
  viewport: { width: number; height: number },
) =>
  Math.max(
    1,
    Math.ceil(
      Math.min(
        viewport.width * FULLSCREEN_VIEWPORT_WIDTH,
        Math.max(1, viewport.height - FULLSCREEN_VERTICAL_GAP) * ratio,
      ),
    ),
  );

const PreloadedPhoto = ({
  photo,
  viewport,
}: {
  photo: Photo;
  viewport: { width: number; height: number };
}) => {
  const { asset, srcSet, fullSrc } = usePhotoAsset(photo.yearFilename);
  // Without responsive metadata, don't speculate with a potentially enormous
  // original. The visible viewer still has its normal legacy fallback.
  if (!asset) return null;
  return (
    <img
      hidden
      aria-hidden="true"
      alt=""
      data-carousel-preload={photo.yearFilename}
      // Lowercase preserves the native attribute with React 18.
      {...{ fetchpriority: "low" }}
      loading="eager"
      decoding="async"
      sizes={`${fullscreenPhotoWidth(asset.width / asset.height, viewport)}px`}
      srcSet={srcSet}
      src={fullSrc}
      onLoad={(event) => {
        // Warm the decoded image as well as the HTTP cache. A failed preload
        // must never affect the current image or prevent normal navigation.
        if (event.currentTarget.decode) {
          void event.currentTarget.decode().catch(() => {});
        }
      }}
    />
  );
};

export const CarouselPreloads = ({
  current,
  previous,
  next,
}: {
  current: Photo;
  previous?: Photo;
  next?: Photo;
}) => {
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const neighbors = new Map<string, Photo>();
  for (const photo of [next, previous]) {
    if (photo && photo.yearFilename !== current.yearFilename) {
      neighbors.set(photo.yearFilename, photo);
    }
  }
  return (
    <>
      {Array.from(neighbors.values()).map((photo) => (
        <PreloadedPhoto
          key={photo.yearFilename}
          photo={photo}
          viewport={viewport}
        />
      ))}
    </>
  );
};
