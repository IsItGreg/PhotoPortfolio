import React from "react";
import styles from "./About.module.scss";

const About = () => {
  return (
    <div className={styles["about"]}>
      <div className={styles["panel"]}>
        <div>Hi!</div>
        <div>
          I've been taking photos for a few years and I finally decided I needed
          to show them somehow. Here's a few that I thought came out pretty
          well.
        </div>
        <div>I use a Fujifilm X-T3 with a 16-80mm and a 35mm prime lens.</div>
      </div>
    </div>
  );
};

export default About;
