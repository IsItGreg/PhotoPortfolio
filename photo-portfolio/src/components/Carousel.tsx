import { useState } from "react";
import { photos } from "../photos";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Carousel.module.scss";

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
};

export const Carousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  return (
    <div className={styles.container}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          className={styles.slide}
          custom={direction}
          key={currentIndex}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = Math.abs(offset.x) * velocity.x;

            if (swipe < -10000) {
              setCurrentIndex((currentIndex + 1) % photos.length);
              setDirection(1);
            } else if (swipe > 10000) {
              setCurrentIndex(
                currentIndex === 0 ? photos.length - 1 : currentIndex - 1
              );
              setDirection(-1);
            }
          }}
        >
          <motion.img
            draggable={false}
            src={photos[currentIndex].src}
            alt={photos[currentIndex].title}
          />
          <motion.div>{photos[currentIndex].title}</motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
