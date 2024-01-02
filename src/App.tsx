import About from "./components/About";
import { Images } from "./components/Images";
import { Navbar } from "./components/Navbar";
import { HashRouter, Route, Routes } from "react-router-dom";

const App = () => {
  return (
    <div className="flex h-screen w-screen flex-col md:flex-row">
      <HashRouter>
        <Navbar />
        <div className="bg-mine-light h-full w-full overflow-hidden">
          <Routes>
            <Route path="/" element={<Images />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </HashRouter>
    </div>
  );
};

export default App;
