import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoCard, Photo } from "../photos";
import { ScrollNudge } from "./ScrollNudge";

const PhotoCardPanel = ({
  photoCard,
  setFullscreen,
}: {
  photoCard: PhotoCard;
  setFullscreen: (photo: Photo) => void;
}) => {
  const aspectToClass = (aspect?: "horizontal" | "vertical" | "square") => {
    switch (aspect) {
      case "horizontal":
        return "flex-img-hor";
      case "vertical":
        return "flex-img-ver";
      case "square":
        return "flex-img-sqr";
      default:
        return "flex-img-hor";
    }
  };

  return (
    <section className="flex h-full snap-center flex-col items-center justify-center px-5 py-5 sm:px-24 sm:py-10">
      <div className="aspect-17/20 flex h-full max-w-full flex-col content-stretch justify-center gap-3">
        {photoCard.rows.map((row, index) => {
          return (
            <div key={`row-${row.at(0)?.title}-${index}`} className="">
              <div className="flex flex-row gap-3">
                {row.map((photo, index) => {
                  return (
                    <div
                      key={`image-${photo.title}-${index}`}
                      className={aspectToClass(photo.aspect)}
                    >
                      <img
                        loading="lazy"
                        className="h-full w-full cursor-zoom-in object-cover shadow-lg transition-all ease-in-out hover:scale-[1.02] hover:drop-shadow-lg"
                        src={photo.src}
                        alt={photo.title}
                        onClick={() => setFullscreen(photo)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const Images = ({ photoCards }: { photoCards: PhotoCard[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fullscreenedImage, setFullscreenedImage] = useState<Photo | null>(
    null,
  );
  const [showFullscreen, setShowFullscreen] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: 0,
      left: 0,
    });
  }, [photoCards]);

  useEffect(() => {
    if (!fullscreenedImage || !scrollRef.current) return;
    const scrollCardHeight = scrollRef.current?.clientHeight;
    const photoPageIndex = photoCards.findIndex((photoCard) =>
      photoCard.rows.find((row) => row.includes(fullscreenedImage)),
    );

    scrollRef.current?.scrollTo({
      top: photoPageIndex * scrollCardHeight,
      left: 0,
    });
  }, [fullscreenedImage, photoCards]);

  const photoArray = photoCards.flatMap((photoCard) => photoCard.rows.flat());

  const fullscreenPrevious = useCallback(() => {
    const photoIndex = photoArray.findIndex(
      (photo) => photo === fullscreenedImage,
    );
    if (photoIndex === 0) return;
    setFullscreenedImage(photoArray[photoIndex - 1]);
  }, [photoArray, fullscreenedImage]);

  const fullscreenNext = useCallback(() => {
    const photoIndex = photoArray.findIndex(
      (photo) => photo === fullscreenedImage,
    );
    if (photoIndex === photoArray.length - 1) return;
    setFullscreenedImage(photoArray[photoIndex + 1]);
  }, [photoArray, fullscreenedImage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        fullscreenNext();
      }
      if (event.key === "ArrowLeft") {
        fullscreenPrevious();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [photoArray, fullscreenedImage, fullscreenNext, fullscreenPrevious]);

  return (
    <div
      className="h-full snap-y snap-mandatory overflow-y-auto"
      ref={scrollRef}
    >
      <div
        className={`absolute left-0 top-0 z-20 flex flex-row h-screen w-screen items-center justify-center ${
          showFullscreen ? "" : "pointer-events-none"
        }`}
      >
        <div
          className="h-full w-1/4 cursor-w-resize"
          onClick={() => fullscreenPrevious()}
        ></div>
        <div
          className="h-full w-1/2 cursor-zoom-out"
          onClick={() => setShowFullscreen(false)}
        ></div>
        <div
          className="h-full w-1/4 cursor-e-resize"
          onClick={() => fullscreenNext()}
        ></div>
      </div>
      <div
        className={`pointer-events-none absolute left-0 top-0 z-10 flex h-screen w-screen items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm transition duration-500 ease-in-out ${
          showFullscreen ? "opacity-100" : "opacity-0"
        }`}
      >
        <img
          loading="lazy"
          className="max-h-[95%] max-w-[95%] object-cover transition duration-300 ease-in-out md:max-h-[90%] md:max-w-[90%]"
          alt={fullscreenedImage?.title}
          src={fullscreenedImage?.src}
        />
      </div>
      <ScrollNudge scrollRef={scrollRef} />
      {photoCards.map((photoCard, index) => {
        return (
          <PhotoCardPanel
            key={`card-${index}`}
            photoCard={photoCard}
            setFullscreen={(photo: Photo | null) => {
              setFullscreenedImage(photo);
              setShowFullscreen(true);
            }}
          />
        );
      })}
    </div>
  );
};
