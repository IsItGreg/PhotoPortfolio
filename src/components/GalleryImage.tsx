import { useLayoutEffect, useRef, useState } from "react";
import { Photo } from "../photos";
import { usePhotoAsset } from "../photoAssets";

export const GalleryImage = ({
  photo,
  active,
  onOpen,
}: {
  photo: Photo;
  active: boolean;
  onOpen: (preview: string) => void;
}) => {
  const { asset, ready, smallSrc, srcSet } = usePhotoAsset(photo.yearFilename);
  const button = useRef<HTMLButtonElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    if (!button.current) return;
    const element = button.current;
    const measure = () =>
      setWidth(Math.ceil(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fallbackRatio =
    photo.aspect === "vertical" ? 2 / 3 : photo.aspect === "square" ? 1 : 3 / 2;
  return (
    <button
      ref={button}
      type="button"
      className="relative block h-full w-full cursor-zoom-in overflow-hidden bg-stone-300 shadow-lg transition-transform duration-200 ease-in-out hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-700 motion-reduce:transition-none"
      style={{
        aspectRatio: asset ? asset.width / asset.height : fallbackRatio,
        backgroundImage: asset ? `url(${asset.placeholder})` : undefined,
        backgroundSize: "cover",
      }}
      aria-label={
        failed ? `Retry loading ${photo.title}` : `Open ${photo.title}`
      }
      onClick={() => {
        if (failed) {
          setFailed(false);
          setAttempt(attempt + 1);
        } else {
          onOpen(
            loaded
              ? image.current?.currentSrc || smallSrc
              : asset?.placeholder || smallSrc,
          );
        }
      }}
    >
      {active && ready && width > 0 && (
        <img
          key={attempt}
          ref={image}
          src={smallSrc}
          srcSet={srcSet}
          sizes={`${width}px`}
          width={asset?.width}
          height={asset?.height}
          decoding="async"
          loading="eager"
          alt={photo.title}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center bg-stone-800/70 p-2 text-sm text-white">
          Photo unavailable. Tap to retry.
        </span>
      )}
    </button>
  );
};
