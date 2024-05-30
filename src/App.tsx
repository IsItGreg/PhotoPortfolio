import About from "./components/About";
import { Images } from "./components/Images";
import { Navbar } from "./components/Navbar";
import { HashRouter, Route, Routes } from "react-router-dom";
import { photoCards2022, photoCards2023, photoCards2024 } from "./photos";

const App = () => {
  return (
    <div className="flex h-screen w-screen flex-col md:flex-row">
      <HashRouter>
        <Navbar />
        <div className="bg-amber-50 h-full w-full overflow-hidden">
          <Routes>
            <Route path="/" element={<Images photoCards={photoCards2024} />} />
            <Route
              path="/2023"
              element={<Images photoCards={photoCards2023} />}
            />
            <Route
              path="/2022"
              element={<Images photoCards={photoCards2022} />}
            />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </HashRouter>
    </div>
  );
};

export default App;
