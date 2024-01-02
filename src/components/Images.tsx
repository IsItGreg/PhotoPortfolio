import { photoCards, PhotoCard } from "../photos";

const PhotoCardPanel = ({ photoCard }: { photoCard: PhotoCard }) => {
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
                        className="h-full w-full object-cover shadow-lg"
                        src={photo.src}
                        alt={photo.title}
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
  return (
    <div className="h-full snap-y snap-mandatory overflow-y-auto">
      {photoCards.map((photoCard, index) => {
        return <PhotoCardPanel key={index} photoCard={photoCard} />;
      })}
    </div>
  );
};
