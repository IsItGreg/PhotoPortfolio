import {
  Environment,
  Loader,
  ScrollControls,
  useScroll,
  Html,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Mat, Box } from "./Box";
import { PhotoStack } from "./PhotoCard";
import * as THREE from "three";
import { Suspense, useState } from "react";
import config from "./sceneConfig.json";
import { defaultInspection, SceneInspection } from "./sceneTypes";
import type SceneInspectorType from "./authoring/SceneInspector";

const SceneInspector: typeof SceneInspectorType | null =
  process.env.NODE_ENV !== "production"
    ? require("./authoring/SceneInspector").default
    : null;

const ControlCamera = ({ orbit }: { orbit: boolean }) => {
  const scroll = useScroll();

  useFrame((state, delta) => {
    if (orbit) return;
    const offset = 1 - scroll.offset;
    state.camera.position.set(
      Math.sin((offset / Math.PI) * 2) * 30,
      7 * offset + 20,
      Math.atan(offset * Math.PI) * 50,
    );
    state.camera.lookAt(0, 0, 0);
    state.camera.rotation.set(
      state.camera.rotation.x,
      state.camera.rotation.y,
      Math.cos(offset) * -0.5 + 0.5,
    );
  });

  return null;
};

export const ThreeDim = () => {
  const [inspection, setInspection] =
    useState<SceneInspection>(defaultInspection);
  return (
    <>
      <Canvas shadows camera={{ position: [20, 10, 50], fov: 45 }}>
        <Suspense
          fallback={
            <Html center>
              <Loader dataInterpolation={(p) => `Loading ${p.toFixed(0)}%`} />
            </Html>
          }
        >
          <fog attach="fog" args={["#000", 2, 300]} />
          <Environment
            preset="night"
            background
            blur={config.environmentBlur}
          />
          {/* <directionalLight position={[-5, 10, 20]} intensity={0.1} /> */}
          <spotLight
            position={[0, 20, 0]}
            rotation={[0, 0, 0]}
            intensity={config.lightIntensity}
            angle={Math.PI / 6}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0001}
            penumbra={0.5}
          />
          <Mat />
          <ScrollControls pages={3}>
            <ControlCamera orbit={inspection.orbit} />
            <Box inspection={inspection} />
            {!inspection.hidePhotos && (
              <PhotoStack position={new THREE.Vector3(0, 0.1, 0)} />
            )}
            {SceneInspector && (
              <SceneInspector value={inspection} onChange={setInspection} />
            )}
          </ScrollControls>
        </Suspense>
      </Canvas>
      {/* <div className="text-center text-sm text-white text-opacity-30 fixed bottom-16 w-full">
        Hello
      </div> */}
    </>
  );
};
