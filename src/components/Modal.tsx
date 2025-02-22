import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

const Modal = ({ isOpen, onClose, children, title }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-xs md:max-w-sm bg-yellow-200 p-6 shadow-xl animate-fade-in transform rotate-1 rounded-sm aspect-square"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
      >
        {/* {title && (
          <h2
            id="modal-title"
            className="mb-4 text-xl font-bold font-handwriting"
          >
            {title}
          </h2>
        )} */}
        <button
          onClick={onClose}
          className="absolute right-6 top-4 text-gray-600 hover:text-gray-800 font-bold"
          aria-label="Close modal"
        >
          ✕
        </button>
        <div className="font-handwriting text-xl md:text-3xl">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
