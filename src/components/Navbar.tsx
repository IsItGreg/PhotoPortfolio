import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <div className="bg-mine-other flex h-14 flex-row items-center justify-evenly gap-5 text-lg text-stone-50 md:h-full md:flex-col md:justify-center">
      <div className="text-center font-mono text-xl font-bold md:text-3xl">
        Gregory Smelkov
      </div>
      <Link className="font-mono hover:text-stone-300 md:text-2xl" to={"/"}>
        photos
      </Link>
      <Link className="font-mono hover:text-stone-300 md:text-2xl" to={"/2022"}>
        2022
      </Link>
      <Link
        className="font-mono hover:text-stone-300 md:text-2xl"
        to={"/about"}
      >
        about
      </Link>
    </div>
  );
};
