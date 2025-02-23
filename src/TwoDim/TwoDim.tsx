import { Copyright } from "../components/Copyright";
import { Header } from "../Header";
import { Images } from "../components/Images";
import { photoCards2023 } from "../photos";

export const TwoDim = () => {
  return (
    <>
      <Header isTwoDim={true} />
      <div className="h-full py-24 bg-stone-500">
        <Images photoCards={photoCards2023} />
      </div>
      <Copyright />
    </>
  );
};
