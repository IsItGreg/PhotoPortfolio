import { Link } from "react-router-dom";
import styles from "./Navbar.module.scss";

export const Navbar = () => {
  return (
    <div className={styles.navbar}>
      <div className={styles["text-name"]}>Gregory Smelkov</div>
      <Link className={styles["navbar-link"]} to={"/"}>
        photos
      </Link>
      <Link className={styles["navbar-link"]} to={"/about"}>
        about
      </Link>
    </div>
  );
};
