import { useState, useEffect } from "react";
import { GiScrollUnfurled } from "react-icons/gi";
import { FaHandPointDown } from "react-icons/fa";

export const ScrollNudge = ({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement>;
}) => {
  const [showScrollNudge, setShowScrollNudge] = useState(false);

  useEffect(() => {
    const _scrollRefCurrent = scrollRef.current;
    if (!_scrollRefCurrent) return;

    let scrollTimeout = setTimeout(() => {
      if (
        _scrollRefCurrent.scrollTop + _scrollRefCurrent.clientHeight <
        _scrollRefCurrent.scrollHeight
      ) {
        setShowScrollNudge(true);
      }
    }, 5000);

    const handleScroll = () => {
      setShowScrollNudge(false);
      clearTimeout(scrollTimeout);
    };

    _scrollRefCurrent.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(scrollTimeout);
      _scrollRefCurrent.removeEventListener("scroll", handleScroll);
    };
  }, [scrollRef]);

  return (
    <div
      className={`absolute bottom-10 right-10 flex flex-col gap-2 justify-center items-center pointer-events-none text-stone-500/50 transition-opacity duration-1000 ease-in-out animate-slow-bounce ${
        showScrollNudge ? "opacity-100" : "opacity-0"
      }`}
    >
      <GiScrollUnfurled className="w-10 h-10" />
      <FaHandPointDown className="w-10 h-10" />
    </div>
  );
};
