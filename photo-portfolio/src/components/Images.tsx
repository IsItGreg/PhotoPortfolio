import { photoCards, PhotoCard } from "../photos";
import styles from "./Images.module.scss";
import classNames from "classnames";

const PhotoCardPanel = ({ photoCard }: { photoCard: PhotoCard }) => {
  return (
    <section className={styles["image-pane"]}>
      <div className={styles["image-pane-square"]}>
        {photoCard.rows.map((row, index) => {
          return (
            <div className={styles["image-row"]}>
              <div className={styles["image-row-inner"]}>
                {row.map((photo, index) => {
                  return (
                    <div
                      className={classNames(styles["image-container"], {
                        [styles.vertical]: photo.vertical,
                      })}
                    >
                      <img
                        className={styles["image"]}
                        src={photo.src}
                        alt={photo.title}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const Images = () => {
  return (
    <div className={styles.container}>
      {photoCards.map((photoCard, index) => {
        return <PhotoCardPanel key={index} photoCard={photoCard} />;
      })}
    </div>
  );
};
