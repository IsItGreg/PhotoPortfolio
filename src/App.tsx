import styles from "./App.module.scss";
import About from "./components/About";
import { Images } from "./components/Images";
import { Navbar } from "./components/Navbar";
import { HashRouter, Route, Routes } from "react-router-dom";

const App = () => {
  return (
    <div className={styles.root}>
      <HashRouter>
        <Navbar />
        <div className={styles.right}>
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
