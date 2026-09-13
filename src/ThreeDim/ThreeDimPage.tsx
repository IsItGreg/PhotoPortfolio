import { lazy, Suspense } from "react";

const ThreeDim = lazy(() =>
  import("./ThreeDim").then((module) => ({ default: module.ThreeDim })),
);

export const ThreeDimPage = () => {
  return (
    <Suspense fallback={null}>
      <ThreeDim />
    </Suspense>
  );
};
