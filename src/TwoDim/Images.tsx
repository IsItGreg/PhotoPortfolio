import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PhotoCard, Photo } from "../photos";
import { ScrollNudge } from "../components/ScrollNudge";
import { FullScreenImage } from "../components/FullScreenImage";
import { GalleryImage } from "../components/GalleryImage";

const PhotoCardPanel = ({
  photoCard,
  first,
  scrollRoot,
  setFullscreen,
}: {
  photoCard: PhotoCard;
  first: boolean;
  scrollRoot: RefObject<HTMLDivElement>;
  setFullscreen: (photo: Photo, preview: string) => void;
}) => {
  const panel = useRef<HTMLElement>(null);
  const [active, setActive] = useState(first);
  useEffect(() => {
    if (active || !panel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      {
        root: scrollRoot.current,
        rootMargin: `${(scrollRoot.current?.clientHeight || 600) * 0.75}px 0px`,
      },
    );
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [active, scrollRoot]);

  const aspectToClass = (aspect?: Photo["aspect"]) =>
    aspect === "vertical"
      ? "flex-img-ver"
      : aspect === "square"
        ? "flex-img-sqr"
        : "flex-img-hor";

  return (
    <section
      ref={panel}
      className="flex h-full snap-center flex-col items-center justify-center px-5 py-32 sm:px-24"
    >
      <div className="flex aspect-17/20 h-full max-w-full flex-col content-stretch justify-center gap-3">
        {photoCard.rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-row gap-3">
            {row.map((photo, index) => (
              <div
                key={`${photo.yearFilename}-${index}`}
                className={`${aspectToClass(photo.aspect)} min-w-0`}
              >
                <GalleryImage
                  photo={photo}
                  active={active}
                  onOpen={(preview) => setFullscreen(photo, preview)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export const Images = ({ photoCards }: { photoCards: PhotoCard[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState<{
    photo: Photo;
    preview?: string;
  } | null>(null);
  const photoArray = useMemo(
    () => photoCards.flatMap((card) => card.rows.flat()),
    [photoCards],
  );
  const fullscreenIndex = fullscreen
    ? photoArray.indexOf(fullscreen.photo)
    : -1;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
    setFullscreen(null);
  }, [photoCards]);

  useEffect(() => {
    if (!fullscreen || !scrollRef.current) return;
    const pageIndex = photoCards.findIndex((card) =>
      card.rows.some((row) => row.includes(fullscreen.photo)),
    );
    scrollRef.current.scrollTo({
      top: pageIndex * scrollRef.current.clientHeight,
      left: 0,
    });
  }, [fullscreen, photoCards]);

  const previous = useCallback(() => {
    if (fullscreenIndex > 0)
      setFullscreen({ photo: photoArray[fullscreenIndex - 1] });
  }, [fullscreenIndex, photoArray]);
  const next = useCallback(() => {
    if (fullscreenIndex >= 0 && fullscreenIndex < photoArray.length - 1) {
      setFullscreen({ photo: photoArray[fullscreenIndex + 1] });
    }
  }, [fullscreenIndex, photoArray]);
  const close = useCallback(() => setFullscreen(null), []);

  return (
    <div
      className="h-full snap-y snap-mandatory overflow-y-auto"
      ref={scrollRef}
    >
      {fullscreen && (
        <FullScreenImage
          key={fullscreen.photo.yearFilename}
          image={fullscreen.photo}
          preview={fullscreen.preview}
          previousPhoto={photoArray[fullscreenIndex - 1]}
          nextPhoto={photoArray[fullscreenIndex + 1]}
          onClose={close}
          prevImg={previous}
          nextImg={next}
          index={fullscreenIndex}
          total={photoArray.length}
        />
      )}
      <ScrollNudge scrollRef={scrollRef} />
      {photoCards.map((photoCard, index) => (
        <PhotoCardPanel
          key={`${index}-${photoCard.rows[0]?.[0]?.yearFilename}`}
          photoCard={photoCard}
          first={index === 0}
          scrollRoot={scrollRef}
          setFullscreen={(photo, preview) => setFullscreen({ photo, preview })}
        />
      ))}
    </div>
  );
};
