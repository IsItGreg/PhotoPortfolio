import { NavLink } from "react-router-dom";
import Modal from "./Modal";
import { useState } from "react";
import About from "./About";
export const Header = ({ isTwoDim = false }: { isTwoDim?: boolean }) => {
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  return (
    <>
      <div className="fixed z-10 flex w-full flex-col pt-8 text-white drop-shadow-lg">
        <div className="mx-auto">
          <span className="select-none font-lost text-6xl">
            Gregory Smelkov
          </span>
        </div>
        <div className="mx-auto h-px w-40 bg-white drop-shadow-lg" />
        <div className="mx-auto flex select-none flex-row gap-4 pt-0.5 font-lost text-2xl font-light drop-shadow-lg">
          <NavLink
            className="transition-all duration-300 ease-in-out hover:text-orange-400"
            to={"/"}
          >
            Box of photos
          </NavLink>
          <NavLink
            className="transition-all duration-300 ease-in-out hover:text-orange-400"
            to={"/nyc"}
          >
            NYC
          </NavLink>
          <NavLink
            className="transition-all duration-300 ease-in-out hover:text-orange-400"
            to={"/travel"}
          >
            Travel
          </NavLink>
          <button
            className="transition-all duration-300 ease-in-out hover:cursor-pointer hover:text-orange-400"
            onClick={() => setAboutModalOpen(true)}
          >
            ABOUT
          </button>
        </div>
      </div>
      <Modal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
        title="About"
      >
        <About />
      </Modal>
    </>
  );
};
