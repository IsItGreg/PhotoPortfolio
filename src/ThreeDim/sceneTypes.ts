export type Vec3 = [number, number, number];
export type LabelSpec = {
  id: string;
  text: string;
  fontSize: number;
  lineHeight: number | string;
  scale: number;
  position: number[];
  rotation: number[];
  surface: string;
};
export type SceneInspection = {
  pose: "scroll" | "flat";
  wireframe: boolean;
  hidePhotos: boolean;
  orbit: boolean;
};
export const defaultInspection: SceneInspection = {
  pose: "scroll",
  wireframe: false,
  hidePhotos: false,
  orbit: false,
};
