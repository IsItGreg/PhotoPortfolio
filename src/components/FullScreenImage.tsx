import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Photo } from "../photos";
import { usePhotoAsset } from "../photoAssets";
import {
  CarouselPreloads,
  FULLSCREEN_VERTICAL_GAP,
  FULLSCREEN_VIEWPORT_WIDTH,
} from "./CarouselPreloads";

export const FullScreenImage = ({
  image,
  preview,
  previousPhoto,
  nextPhoto,
  onClose,
  prevImg,
  nextImg,
  index,
  total,
}: {
  image: Photo;
  preview?: string;
  previousPhoto?: Photo;
  nextPhoto?: Photo;
  onClose: () => void;
  prevImg: () => void;
  nextImg: () => void;
  index: number;
  total: number;
}) => {
  const { asset, ready, fullSrc, smallSrc, srcSet } = usePhotoAsset(
    image.yearFilename,
  );
  const dialog = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ratio = asset
    ? asset.width / asset.height
    : image.aspect === "vertical"
      ? 2 / 3
      : image.aspect === "square"
        ? 1
        : 3 / 2;

  useLayoutEffect(() => {
    if (!frame.current) return;
    const element = frame.current;
    const measure = () =>
      setWidth(Math.ceil(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ratio]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previousFocus?.focus();
  }, []);

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          prevImg();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          nextImg();
        }
        if (event.key === "Tab") {
          const buttons = Array.from(
            dialog.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) || [],
          );
          const first = buttons[0],
            last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <button
        onClick={onClose}
        className="absolute right-3 top-3 p-2 text-white hover:text-orange-400"
      >
        CLOSE
      </button>
      <div
        ref={frame}
        className="relative overflow-hidden"
        style={{
          width: `min(${
            FULLSCREEN_VIEWPORT_WIDTH * 100
          }vw, calc((100dvh - ${FULLSCREEN_VERTICAL_GAP}px) * ${ratio}))`,
          aspectRatio: ratio,
        }}
        aria-busy={!loaded && !failed}
      >
        <img
          src={preview || asset?.placeholder || smallSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain"
        />
        {ready && width > 0 && (
          <img
            key={attempt}
            src={fullSrc}
            srcSet={srcSet}
            sizes={`${width}px`}
            width={asset?.width}
            height={asset?.height}
            decoding="async"
            loading="eager"
            alt={image.title}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 motion-reduce:transition-none ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
      </div>
      {loaded && !failed && (
        <CarouselPreloads
          current={image}
          previous={index > 0 ? previousPhoto : undefined}
          next={index < total - 1 ? nextPhoto : undefined}
        />
      )}
      <div className="absolute bottom-3 flex items-center gap-4 text-white">
        <button
          onClick={prevImg}
          className="p-2 hover:text-orange-400 disabled:opacity-40"
          disabled={index === 0}
        >
          PREV
        </button>
        <span className="text-sm">
          {index + 1} / {total}
        </span>
        <button
          onClick={nextImg}
          className="p-2 hover:text-orange-400 disabled:opacity-40"
          disabled={index === total - 1}
        >
          NEXT
        </button>
      </div>
      {failed && (
        <button
          className="absolute bottom-16 bg-black/70 px-3 py-2 text-sm text-white"
          onClick={() => {
            setFailed(false);
            setAttempt(attempt + 1);
          }}
        >
          Larger photo unavailable. Retry
        </button>
      )}
    </div>
  );
};
