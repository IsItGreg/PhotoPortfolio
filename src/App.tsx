import { HashRouter, Route, Routes } from "react-router-dom";
import { ThreeDimPage } from "./ThreeDim/ThreeDimPage";
import { TwoDimPage } from "./TwoDim/TwoDimPage";
import { Navbar } from "./components/Navbar";
import About from "./components/About";
import { Images } from "./components/Images";
import { photoCards2023 } from "./photos";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ThreeDimPage />} />
        <Route path="/2d" element={<TwoDimPage />} />
        <Route
          path="/old"
          element={
            <div className="flex h-screen w-screen flex-col md:flex-row">
              <Navbar />
              <div className="bg-amber-50 h-full w-full overflow-hidden">
                <Images photoCards={photoCards2023} />
              </div>
            </div>
          }
        />
      </Routes>
    </HashRouter>
  );
};

export default App;
