import baked from "./generated/scene-assets.json";

export const sceneAssets: {
  model: string;
  woodColor: string;
  woodNormal: string;
  font?: string;
} =
  process.env.NODE_ENV === "production"
    ? baked
    : require("./authoring/assets").default;
