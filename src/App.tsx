import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { ThreeDimPage } from "./ThreeDim/ThreeDimPage";
import { TwoDimPage } from "./TwoDim/TwoDimPage";
import { Navbar } from "./components/Navbar";
import { Header } from "./components/Header";
import { Copyright } from "./components/Copyright";
import { Images } from "./TwoDim/Images";
import { photoCards2023 } from "./photos";
import { PhotoAssetProvider } from "./photoAssets";
import {
  PageGalleryProvider,
  usePageGalleries,
  useGalleryStatus,
} from "./pageGalleries";

const GalleryRoutes = () => {
  const galleries = usePageGalleries();
  const status = useGalleryStatus();
  return (
    <HashRouter>
      <Header />
      <Routes>
        <Route path="/" element={<ThreeDimPage />} />
        {galleries.map((gallery) => (
          <Route
            key={gallery.id}
            path={`/${gallery.slug}`}
            element={<TwoDimPage photoCards={gallery.pages} />}
          />
        ))}
        {process.env.NODE_ENV !== "production" && (
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
        )}
        <Route
          path="*"
          element={
            <main
              className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-stone-200 to-stone-400 px-8 pb-16 pt-40 text-stone-800"
              aria-busy={status === "loading"}
            >
              <p
                role="status"
                className={status === "loading" ? "sr-only" : undefined}
              >
                {status === "loading"
                  ? "Loading galleries…"
                  : status === "error"
                    ? "Galleries could not be loaded. Please try refreshing."
                    : "This gallery is unavailable."}
              </p>
              {status !== "loading" && (
                <Link className="underline underline-offset-4" to="/">
                  Back to the box of photos
                </Link>
              )}
            </main>
          }
        />
      </Routes>
      <Copyright />
    </HashRouter>
  );
};

const App = () => (
  <PhotoAssetProvider>
    <PageGalleryProvider>
      <GalleryRoutes />
    </PageGalleryProvider>
  </PhotoAssetProvider>
);

export default App;
