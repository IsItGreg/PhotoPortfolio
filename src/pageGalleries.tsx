import { createContext, useContext, useEffect, useState } from "react";
import { Gallery, getVisibleGalleries } from "./galleryCatalog";

const GalleryContext = createContext<{
  galleries: Gallery[];
  status: "loading" | "ready" | "error";
}>({ galleries: [], status: "loading" });
export const usePageGalleries = () => useContext(GalleryContext).galleries;
export const useGalleryStatus = () => useContext(GalleryContext).status;

export const PageGalleryProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.PUBLIC_URL}/photo-pages.json`, {
      cache: "no-cache",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load photo pages");
        return response.json();
      })
      .then((catalog) => {
        setGalleries(getVisibleGalleries(catalog));
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error(error);
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <GalleryContext.Provider value={{ galleries, status }}>
      {children}
    </GalleryContext.Provider>
  );
};
