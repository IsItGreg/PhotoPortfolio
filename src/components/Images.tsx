import { useState } from "react";
import { photoCards, PhotoCard, Photo } from "../photos";

const PhotoCardPanel = ({
  photoCard,
  setFullscreen,
}: {
  photoCard: PhotoCard;
  setFullscreen: (photo: Photo) => void;
}) => {
  return (
    <section className="flex h-full snap-center flex-col items-center justify-center px-5 py-5 sm:px-24 sm:py-10">
      <div className="aspect-17/20 flex h-full max-w-full flex-col content-stretch justify-center gap-3">
        {photoCard.rows.map((row, index) => {
          return (
            <div className="">
              <div className="flex flex-row gap-3">
                {row.map((photo, index) => {
                  return (
                    <div
                      className={
                        photo.vertical ? "flex-img-ver" : "flex-img-hor"
                      }
                    >
                      <img
                        className="h-full w-full cursor-zoom-in object-cover shadow-lg transition ease-in-out hover:scale-[1.02]"
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

export const Images = () => {
  const [fullscreenedImage, setFullscreenedImage] = useState<Photo | null>(
    null,
  );

  return (
    <div className="h-full snap-y snap-mandatory overflow-y-auto">
      {photoCards.map((photoCard, index) => {
        return (
          <>
            <div
              className={`absolute left-0 top-0 z-10 flex h-screen w-screen cursor-zoom-out items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm transition duration-100 ease-in-out ${
                fullscreenedImage ? "opacity-100" : "hidden opacity-0"
              }`}
              onClick={() => {
                setFullscreenedImage(null);
              }}
            >
              <img
                className="max-h-[95%] max-w-[95%] object-cover md:max-h-[90%] md:max-w-[90%]"
                src={fullscreenedImage?.src}
              />
            </div>
            <PhotoCardPanel
              key={index}
              photoCard={photoCard}
              setFullscreen={(photo: Photo | null) => {
                setFullscreenedImage(photo);
              }}
            />
          </>
        );
      })}
    </div>
  );
};
