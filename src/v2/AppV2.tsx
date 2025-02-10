import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  useGLTF,
  ContactShadows,
  Environment,
  OrbitControls,
  ScrollControls,
  Scroll,
  useScroll,
  Sky,
  GizmoHelper,
  GizmoViewport,
  GizmoViewcube,
} from "@react-three/drei";
import { useRef } from "react";

const WIDTH = 8;
const HEIGHT = 2.75;

const Panel = ({
  pos,
  rotation,
  width,
  height,
}: {
  pos: THREE.Vector3;
  rotation: THREE.Euler;
  width: number;
  height: number;
}) => {
  return (
    <mesh position={pos} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshToonMaterial color="#A07F66" side={THREE.DoubleSide} />
    </mesh>
  );
};

const BoxBottom = () => {
  return (
    <group>
      {/* Back panel */}
      <Panel
        pos={new THREE.Vector3(0, HEIGHT / 2, -WIDTH / 2)}
        rotation={new THREE.Euler(0, 0, 0)}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Front panel */}
      <Panel
        pos={new THREE.Vector3(0, HEIGHT / 2, WIDTH / 2)}
        rotation={new THREE.Euler(0, 0, 0)}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Left panel */}
      <Panel
        pos={new THREE.Vector3(-WIDTH / 2, HEIGHT / 2, 0)}
        rotation={new THREE.Euler(0, Math.PI / 2, 0)}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Right panel */}
      <Panel
        pos={new THREE.Vector3(WIDTH / 2, HEIGHT / 2, 0)}
        rotation={new THREE.Euler(0, -Math.PI / 2, 0)}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Bottom panel */}
      <Panel
        pos={new THREE.Vector3(0, 0, 0)}
        rotation={new THREE.Euler(Math.PI / 2, 0, 0)}
        width={WIDTH}
        height={WIDTH}
      />
    </group>
  );
};

const Box = () => {
  const scroll = useScroll();
  const offset = 1 - scroll.offset;

  useFrame((state, delta) => {
    // The offset is between 0 and 1, you can apply it to your models any way you like
    const offset = 1 - scroll.offset;
    console.log(offset);
    // const offset = scroll.offset;
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

  return (
    // <mesh>
    //   <boxGeometry args={[8, 2.75, 8]} />
    //   <meshToonMaterial color="#A07F66" />
    // </mesh>
    <>
      {/* <BoxLid /> */}
      <BoxBottom />
    </>
  );
};

export const AppV2 = () => {
  return (
    <>
      <Canvas shadows camera={{ position: [20, 10, 50], fov: 45 }}>
        {/* <ambientLight intensity={0.03} />
        <fog attach="fog" args={["#ff5020", 5, 18]} />
        <spotLight
          angle={0.14}
          color=""
          penumbra={1}
          position={[25, 50, -20]}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          castShadow
        />
        <Sky sunPosition={[2, 0.4, 10]} /> */}
        {/* <OrbitControls
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          enableZoom={false}
          enablePan={false}
        /> */}
        <gridHelper args={[20, 20]} />
        <GizmoHelper>
          <GizmoViewcube />
        </GizmoHelper>
        <directionalLight position={[0, 2, 10]} intensity={0.8} />
        <spotLight position={[0, 10, 0]} rotation={[0, 0, 0]} intensity={100} />
        <ScrollControls pages={3}>
          <Box />
        </ScrollControls>
      </Canvas>
    </>
  );
};
