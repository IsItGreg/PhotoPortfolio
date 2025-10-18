import { getFullresImageSrc, Photo } from "../photos";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
export const FullScreenImage = ({
  image,
  onClose,
  prevImg,
  nextImg,
}: {
  image: Photo;
  onClose: () => void;
  prevImg: () => void;
  nextImg: () => void;
}) => {
  return (
    <div className="absolute left-0 top-0 z-10 flex h-screen w-screen items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm transition duration-500 ease-in-out flex-col">
      <img
        loading="lazy"
        className="max-h-[95%] max-w-[95%] object-cover transition duration-300 ease-in-out md:max-h-[90%] md:max-w-[90%]"
        alt={image.title}
        src={getFullresImageSrc(image.yearFilename)}
      />
      <div className="flex flex-row gap-4 text-white">
        <button onClick={prevImg}>
          <FaArrowLeft />
        </button>
        <button onClick={nextImg}>
          <FaArrowRight />
        </button>
      </div>
    </div>
  );
};
