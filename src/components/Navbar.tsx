import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <div className="bg-orange-950 flex h-14 flex-row items-center justify-evenly gap-5 text-lg text-stone-100 md:h-full md:flex-col md:justify-center shadow">
      <Link
        className="text-center font-mono text-xl font-bold md:text-3xl"
        to={"/"}
      >
        Gregory Smelkov
      </Link>
      <Link
        className="font-mono hover:text-stone-300 md:text-2xl p-2"
        to={"/2024"}
      >
        2024
      </Link>
      <Link
        className="font-mono hover:text-stone-300 md:text-2xl p-2"
        to={"/2023"}
      >
        2023
      </Link>
      <Link
        className="font-mono hover:text-stone-300 md:text-2xl p-2"
        to={"/2022"}
      >
        2022
      </Link>
      <Link
        className="font-mono hover:text-stone-300 md:text-2xl p-2"
        to={"/about"}
      >
        about
      </Link>
    </div>
  );
};
