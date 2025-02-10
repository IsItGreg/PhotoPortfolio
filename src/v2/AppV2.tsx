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

const BoxLid = () => {
  const scroll = useScroll();
  const lidRef = useRef<THREE.Group>(null);
  const tabRef = useRef<THREE.Group>(null);
  const rightTabRef = useRef<THREE.Mesh>(null);
  const leftTabRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const offset = scroll.offset;
    const lidDelay = 0.4;
    console.log(offset);
    console.log(Math.max(offset - lidDelay, 0));
    if (lidRef.current) {
      lidRef.current.rotation.x =
        (Math.cos(Math.max(offset - lidDelay, 0)) * -0.5 + 0.5) * -8 * Math.PI;
    }
    if (tabRef.current) {
      tabRef.current.rotation.x = Math.atan(offset) * -1 * Math.PI;
    }
    if (rightTabRef.current) {
      rightTabRef.current.rotation.y =
        Math.PI / 2 +
        (Math.cos(Math.max(offset - lidDelay, 0)) * -0.5 + 0.5) * 2 * Math.PI;
    }
    if (leftTabRef.current) {
      leftTabRef.current.rotation.y =
        Math.PI / 2 -
        (Math.cos(Math.max(offset - lidDelay, 0)) * -0.5 + 0.5) * 2 * Math.PI;
    }
  });

  return (
    <group ref={lidRef} position={[0, HEIGHT, -WIDTH / 2]}>
      <Panel
        pos={new THREE.Vector3(0, 0, WIDTH / 2)}
        rotation={new THREE.Euler(Math.PI / 2, 0, 0)}
        width={WIDTH}
        height={WIDTH}
      />
      <group ref={tabRef} position={[0, 0, WIDTH]}>
        <Panel
          pos={new THREE.Vector3(0, -HEIGHT / 2, 0)}
          rotation={new THREE.Euler(0, 0, 0)}
          width={WIDTH}
          height={HEIGHT}
        />
        <mesh
          ref={rightTabRef}
          position={[WIDTH / 2, 0, 0]}
          rotation={new THREE.Euler(Math.PI, Math.PI / 2, Math.PI / 2)}
        >
          <circleGeometry args={[HEIGHT, undefined, undefined, Math.PI / 2]} />
          <meshToonMaterial color="#A07F66" side={THREE.DoubleSide} />
        </mesh>
        <mesh
          ref={leftTabRef}
          position={[-WIDTH / 2, 0, 0]}
          rotation={new THREE.Euler(Math.PI, Math.PI / 2, Math.PI / 2)}
        >
          <circleGeometry args={[HEIGHT, undefined, undefined, Math.PI / 2]} />
          <meshToonMaterial color="#A07F66" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
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
    // console.log(offset);
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
    <>
      <BoxLid />
      <BoxBottom />
    </>
  );
};

export const AppV2 = () => {
  return (
    <>
      <Canvas shadows camera={{ position: [20, 10, 50], fov: 45 }}>
        <gridHelper args={[20, 20]} />
        <GizmoHelper>
          <GizmoViewcube />
        </GizmoHelper>
        <directionalLight position={[0, 2, 10]} intensity={0.8} />
        <spotLight
          position={[0, 20, 0]}
          rotation={[0, 0, 0]}
          intensity={200}
          angle={Math.PI / 4}
        />
        <ScrollControls pages={3}>
          <Box />
        </ScrollControls>
      </Canvas>
    </>
  );
};
