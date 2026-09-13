import { lazy, Suspense } from "react";
import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { TwoDimPage } from "./TwoDim/TwoDimPage";
import { Navbar } from "./components/Navbar";
import { Images } from "./TwoDim/Images";
import { photoCards2023 } from "./photos";
import { PhotoAssetProvider } from "./photoAssets";
import {
  PageGalleryProvider,
  usePageGalleries,
  useGalleryStatus,
} from "./pageGalleries";

const ThreeDimPage = lazy(() =>
  import("./ThreeDim/ThreeDimPage").then((module) => ({
    default: module.ThreeDimPage,
  })),
);

const GalleryRoutes = () => {
  const galleries = usePageGalleries();
  const status = useGalleryStatus();
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense
              fallback={
                <main
                  className="flex h-screen items-center justify-center bg-stone-900 text-white"
                  role="status"
                >
                  Loading the box of photos…
                </main>
              }
            >
              <ThreeDimPage />
            </Suspense>
          }
        />
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
            <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-amber-50 p-8 text-stone-800">
              <p role="status">
                {status === "loading"
                  ? "Loading galleries…"
                  : status === "error"
                    ? "Galleries could not be loaded. Please try refreshing."
                    : "This gallery is unavailable."}
              </p>
              <Link className="underline underline-offset-4" to="/">
                Back to the box of photos
              </Link>
            </main>
          }
        />
      </Routes>
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
