import { NavLink } from "react-router-dom";
import Modal from "./Modal";
import { useState } from "react";
import About from "./About";
export const Header = ({ isTwoDim = false }: { isTwoDim?: boolean }) => {
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  return (
    <>
      <div className="fixed flex flex-col z-10 w-full pt-8 text-white drop-shadow-lg">
        <div className="mx-auto">
          <span className="text-6xl font-lost select-none">
            Gregory Smelkov
          </span>
        </div>
        <div className="mx-auto w-32 h-px bg-white drop-shadow-lg" />
        <div className="mx-auto flex flex-row gap-4 font-lost text-2xl select-none drop-shadow-lg">
          <NavLink
            className="hover:text-orange-400 transition-all duration-300 ease-in-out"
            to={isTwoDim ? "/" : "/2d"}
          >
            {isTwoDim ? "3D" : "2D"}
          </NavLink>
          <button
            className="hover:text-orange-400 hover:cursor-pointer transition-all duration-300 ease-in-out"
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
