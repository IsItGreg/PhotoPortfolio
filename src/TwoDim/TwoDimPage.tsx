import { Copyright } from "../components/Copyright";
import { Header } from "../components/Header";
import { Images } from "../components/Images";
import { favoriteCards } from "../photos";

export const TwoDimPage = () => {
  return (
    <>
      <Header isTwoDim={true} />
      <div className="h-full bg-gradient-to-br from-stone-200 to-stone-400">
        <Images photoCards={favoriteCards} />
      </div>
      <Copyright />
    </>
  );
};
