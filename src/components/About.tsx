const About = () => {
  return (
    <div className="font-handwriting text-xl md:text-3xl">
      <p>Hello! 👋</p>
      <p>
        I've been taking photos for a few years and wanted to find a way to
        share them.
      </p>
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
    </div>
  );
};

export default About;
