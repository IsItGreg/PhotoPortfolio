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
import { Suspense } from "react";

const ControlCamera = () => {
  const scroll = useScroll();

  useFrame((state, delta) => {
    const offset = 1 - scroll.offset;
    state.camera.position.set(
      Math.sin((offset / Math.PI) * 2) * 30,
      Math.cos((offset + Math.PI / 2) / 3) * 20 + 5,
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
  return (
    <Canvas shadows camera={{ position: [20, 10, 50], fov: 45 }}>
      <Suspense
        fallback={
          <Html center>
            <Loader dataInterpolation={(p) => `Loading ${p.toFixed(0)}%`} />
          </Html>
        }
      >
        <fog attach="fog" args={["#000", 2, 300]} />
        <Environment preset="night" background blur={0.5} />
        {/* <directionalLight position={[-5, 10, 20]} intensity={0.1} /> */}
        <spotLight
          position={[0, 20, 0]}
          rotation={[0, 0, 0]}
          intensity={700}
          angle={Math.PI / 6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          penumbra={0.5}
        />
        <Mat />
        <ScrollControls pages={3}>
          <ControlCamera />
          <Box />
          <PhotoStack position={new THREE.Vector3(0, 0.1, 0)} />
        </ScrollControls>
      </Suspense>
    </Canvas>
  );
};
