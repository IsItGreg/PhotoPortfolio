import { createContext, useContext, useEffect, useState } from "react";
import { getCompressedImageSrc, getFullresImageSrc } from "./photos";

export type ImageVariant = {
  url: string;
  width: number;
  height: number;
  bytes: number;
};
export type PhotoAsset = {
  width: number;
  height: number;
  placeholder: string;
  variants: ImageVariant[];
  full: ImageVariant;
};

const PhotoAssets = createContext<Record<string, PhotoAsset> | null>(null);
const publicUrl = (url: string) => `${process.env.PUBLIC_URL}${url}`;

export const PhotoAssetProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [assets, setAssets] = useState<Record<string, PhotoAsset> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.PUBLIC_URL}/photo-assets.json`, {
      cache: "no-cache",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Photo sizes unavailable");
        return response.json();
      })
      .then(setAssets)
      .catch((error) => {
        // Older builds can still use the original small/full image paths.
        if (error.name !== "AbortError") setAssets({});
      });
    return () => controller.abort();
  }, []);
  return <PhotoAssets.Provider value={assets}>{children}</PhotoAssets.Provider>;
};

export const usePhotoAsset = (key: string) => {
  const assets = useContext(PhotoAssets);
  const asset = assets?.[key];
  return {
    ready: assets !== null,
    asset,
    srcSet: asset?.variants
      .map((v) => `${publicUrl(v.url)} ${v.width}w`)
      .join(", "),
    smallSrc: asset
      ? publicUrl(asset.variants[0].url)
      : getCompressedImageSrc(key),
    fullSrc: asset ? publicUrl(asset.full.url) : getFullresImageSrc(key),
  };
};
