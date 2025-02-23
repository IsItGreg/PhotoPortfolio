import { NavLink } from "react-router-dom";
import Modal from "./components/Modal";
import { useState } from "react";

export const Header = ({ isTwoDim = false }: { isTwoDim?: boolean }) => {
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  return (
    <>
      <div className="fixed flex flex-col z-10 w-full pt-8 text-white">
        <div className="mx-auto">
          <span className="text-6xl font-lost select-none">
            Gregory Smelkov
          </span>
        </div>
        <div className="mx-auto w-32 h-px bg-white" />
        <div className="mx-auto flex flex-row gap-4 font-lost text-2xl select-none">
          <NavLink
            className="hover:text-orange-400 transition-all duration-300 ease-in-out"
            to={isTwoDim ? "/" : "/2d"}
          >
            {isTwoDim ? "3D" : "2D"}
          </NavLink>
          <a
            className="hover:text-orange-400 hover:cursor-pointer transition-all duration-300 ease-in-out"
            onClick={() => setAboutModalOpen(true)}
          >
            ABOUT
          </a>
        </div>
      </div>
      <Modal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
        title="About"
      >
        <p>Hello! 👋</p>
        <p>
          I've been taking photos for a few years and wanted to find a way to
          share them.
        </p>
        {/* <p>This site has been a </p> */}
        <p>
          Feel free to reach me at{" "}
          <a href="mailto:photo@gsme.dev" className="text-orange-600">
            photo@gsme.dev
          </a>{" "}
          or on{" "}
          <a
            href="https://www.instagram.com/gregosmelko/"
            className="text-orange-600"
          >
            Instagram
          </a>
          .
        </p>
        <p className="text-right">-Greg</p>
      </Modal>
    </>
  );
};
