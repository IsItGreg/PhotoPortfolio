import { HashRouter, Route, Routes } from "react-router-dom";
import { ThreeDimPage } from "./ThreeDim/ThreeDimPage";
import { TwoDimPage } from "./TwoDim/TwoDimPage";
import { Navbar } from "./components/Navbar";
import { Images } from "./TwoDim/Images";
import {
  favoriteCards,
  nycPhotoCards,
  photoCards2023,
  travelPhotoCards,
} from "./photos";

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ThreeDimPage />} />
        <Route
          path="/nyc"
          element={<TwoDimPage photoCards={nycPhotoCards} />}
        />
        <Route
          path="/travel"
          element={<TwoDimPage photoCards={travelPhotoCards} />}
        />
        {/* <Route path="/2d" element={<TwoDimPage photoCards={favoriteCards} />} /> */}
        <Route
          path="/old"
          element={
            <div className="flex h-screen w-screen flex-col md:flex-row">
              <Navbar />
              <div className="h-full w-full overflow-hidden bg-amber-50">
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
