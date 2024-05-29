const About = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center font-mono text-lg text-stone-50">
      <div className="bg-mine-dark w-3/4 rounded p-5 shadow-lg md:max-w-2xl flex flex-col gap-4">
        <div>Hi! 👋</div>
        <div>
          I've been taking photos for a few years and I finally decided I needed
          to show them somehow. Here are some of my favorites from the last few
          years.
        </div>
        <div>
          If for whatever reason you want to use a photo, feel free to send me
          an email at{" "}
          <a
            href="mailto:photo@gsme.dev"
            className="text-blue-200 hover:text-blue-400"
          >
            photo@gsme.dev
          </a>
          .
        </div>
      </div>
    </div>
  );
};

export default About;
