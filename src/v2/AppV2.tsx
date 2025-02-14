import { Canvas, useFrame } from "@react-three/fiber";
import {
  ScrollControls,
  GizmoHelper,
  GizmoViewport,
  GizmoViewcube,
  useScroll,
  Environment,
} from "@react-three/drei";
import { Box, Mat } from "./Box";
import { PhotoStack } from "./PhotoCard";
import * as THREE from "three";
import {
  Selection,
  Select,
  EffectComposer,
  Outline,
} from "@react-three/postprocessing";

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

export const AppV2 = () => {
  return (
    <>
      <Canvas shadows camera={{ position: [20, 10, 50], fov: 45 }}>
        {/* <gridHelper args={[20, 20]} /> */}
        {/* <GizmoHelper>
          <GizmoViewcube />
        </GizmoHelper> */}
        <fog attach="fog" args={["#000", 2, 300]} />
        <Environment preset="night" background blur={0.5} />
        <directionalLight position={[-5, 10, 20]} intensity={1} />
        <spotLight
          position={[0, 20, 0]}
          rotation={[0, 0, 0]}
          intensity={400}
          angle={Math.PI / 6}
        />
        <Mat />
        <ScrollControls pages={3}>
          <ControlCamera />
          <Box />
          {/* <Selection>
            <EffectComposer multisampling={8} autoClear={false}>
              <Outline
                blur
                visibleEdgeColor={0xffffff}
                edgeStrength={10}
                width={1000}
              />
            </EffectComposer> */}
          <PhotoStack position={new THREE.Vector3(0, 0.1, 0)} />
          {/* </Selection> */}
        </ScrollControls>
      </Canvas>
    </>
  );
};
