import { NavLink } from "react-router-dom";

export const Navbar = () => {
  return (
    <div className="flex h-14 flex-row items-center justify-evenly bg-orange-950 font-sans text-lg font-bold text-stone-400 shadow sm:gap-5 md:h-full md:flex-col md:justify-center">
      <NavLink
        className={({ isActive }) =>
          `mt-1 p-2 text-center font-lost text-3xl font-bold hover:text-stone-100 md:text-5xl ${
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
          `p-2 hover:text-stone-100 md:text-xl ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2024"}
      >
        2024
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `p-2 hover:text-stone-100 md:text-xl ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2023"}
      >
        2023
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `p-2 hover:text-stone-100 md:text-xl ${
            isActive ? "text-stone-100" : ""
          }`
        }
        to={"/2022"}
      >
        2022
      </NavLink>
      <NavLink
        className={({ isActive }) =>
          `p-2 hover:text-stone-100 md:text-xl ${
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
