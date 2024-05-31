import { NavLink } from "react-router-dom";

export const Navbar = () => {
  return (
    <div className="bg-orange-950 flex h-14 flex-row items-center justify-evenly gap-5 text-lg text-stone-400 md:h-full md:flex-col md:justify-center shadow">
      <NavLink
        className={({ isActive }) =>
          `text-center font-mono text-xl font-bold md:text-3xl p-2 hover:text-stone-100 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/"}
      >
        Gregory Smelkov
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `font-mono hover:text-stone-100 md:text-2xl p-2 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2024"}
      >
        2024
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `font-mono hover:text-stone-100 md:text-2xl p-2 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2023"}
      >
        2023
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `font-mono hover:text-stone-100 md:text-2xl p-2 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2022"}
      >
        2022
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `font-mono hover:text-stone-100 md:text-2xl p-2 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/about"}
      >
        about
      </NavLink>
    </div>
  );
};
