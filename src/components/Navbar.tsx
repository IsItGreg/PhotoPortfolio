import { NavLink } from "react-router-dom";

export const Navbar = () => {
  return (
    <div className="bg-orange-950 font-bold font-sans flex h-14 flex-row items-center justify-evenly sm:gap-5 text-lg text-stone-400 md:h-full md:flex-col md:justify-center shadow">
      <NavLink
        className={({ isActive }) =>
          `text-center font-name text-3xl font-bold md:text-5xl p-2 mt-1 hover:text-stone-100 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/"}
      >
        Gregory Smelkov
      </NavLink>
      <div className="grow sm:grow-0" />
      <NavLink
        className={({ isActive }) =>
          `hover:text-stone-100 md:text-xl p-2 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2024"}
      >
        2024
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `hover:text-stone-100 md:text-xl p-2 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2023"}
      >
        2023
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `hover:text-stone-100 md:text-xl p-2 ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2022"}
      >
        2022
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `hover:text-stone-100 md:text-xl p-2 ${
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
