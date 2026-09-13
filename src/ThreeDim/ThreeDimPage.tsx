import { lazy, Suspense } from "react";
import { Header } from "../components/Header";
import { Copyright } from "../components/Copyright";

const ThreeDim = lazy(() =>
  import("./ThreeDim").then((module) => ({ default: module.ThreeDim })),
);

export const ThreeDimPage = () => {
  return (
    <>
      <Header />
      <Suspense fallback={null}>
        <ThreeDim />
      </Suspense>
      <Copyright />
    </>
  );
};
