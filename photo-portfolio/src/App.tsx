import styles from "./App.module.scss";
import { Navbar } from "./components/Navbar";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const App = () => {
  return (
    <div className={styles.root}>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route
            path="/"
            element={<div className={styles.right}>images</div>}
          />
          <Route
            path="/about"
            element={<div className={styles.right}>about</div>}
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
