import { useEffect, useRef, useState } from "react";
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

  return (
    <div
      className="h-full snap-y snap-mandatory overflow-y-auto"
      ref={scrollRef}
    >
      <div
        className={`absolute left-0 top-0 z-10 flex h-screen w-screen cursor-zoom-out items-center justify-center bg-black bg-opacity-90 backdrop-blur-sm transition duration-500 ease-in-out ${
          showFullscreen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          setShowFullscreen(false);
        }}
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
