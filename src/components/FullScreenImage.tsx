import { getFullresImageSrc, Photo } from "../photos";
export const FullScreenImage = ({
  image,
  onClose,
  prevImg,
  nextImg,
  index,
  total,
}: {
  image: Photo;
  onClose: () => void;
  prevImg: () => void;
  nextImg: () => void;
  index: number;
  total: number;
}) => {
  return (
    <div
      onClick={(e) => {
        // Only close if clicking the backdrop itself
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="absolute left-0 top-0 z-10 flex h-screen w-screen items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm transition duration-500 ease-in-out flex-col"
    >
      <button
        onClick={onClose}
        className="select-none absolute top-2 right-2 text-white hover:text-orange-400 transition-all ease-in-out duration-150"
      >
        CLOSE
      </button>
      <img
        loading="lazy"
        className="max-h-[90%] max-w-[95%] object-cover transition duration-300 ease-in-out md:max-w-[90%]"
        alt={image.title}
        src={getFullresImageSrc(image.yearFilename)}
      />
      <div className="flex flex-row gap-4 text-white absolute bottom-2">
        <button
          onClick={prevImg}
          className="select-none hover:text-orange-400 transition-all ease-in-out duration-150 disabled:opacity-60  disabled:pointer-events-none"
          disabled={index === 0}
        >
          PREV
        </button>
        /
        <button
          onClick={nextImg}
          className="select-none hover:text-orange-400 transition-all ease-in-out duration-150 disabled:opacity-60 disabled:pointer-events-none"
          disabled={index === total - 1}
        >
          NEXT
        </button>
      </div>
    </div>
  );
};
