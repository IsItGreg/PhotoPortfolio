import { Images } from "./Images";
import { PhotoCard } from "../photos";

export const TwoDimPage = ({ photoCards }: { photoCards: PhotoCard[] }) => {
  return (
    <div className="h-full bg-gradient-to-br from-stone-200 to-stone-400">
      <Images photoCards={photoCards} />
    </div>
  );
};
