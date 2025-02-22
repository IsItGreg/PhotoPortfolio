import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScroll, useTexture } from "@react-three/drei";
import { useRef } from "react";

const WIDTH = 8;
const HEIGHT = 2.75;
const THICKNESS = 0.1;

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
  const props = useTexture({
    map: "Paper004_1K-JPG_Color.jpg",
    normalMap: "Paper004_1K-JPG_NormalDX.jpg",
    roughnessMap: "Paper004_1K-JPG_Roughness.jpg",
  });

  const textureScaleY = 1 / WIDTH;
  const textureScaleX = 1 / HEIGHT;
  // props.map.wrapS = THREE.RepeatWrapping;
  // props.map.wrapT = THREE.RepeatWrapping;
  // props.map.repeat.set(width * textureScaleX, height * textureScaleY);

  return (
    <mesh position={pos} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={[width, height, THICKNESS]} />
      <meshStandardMaterial
        map={props.map}
        side={THREE.DoubleSide}
        color="#ffffff"
      />
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
    // console.log(offset);
    // console.log(Math.max(offset - lidDelay, 0));
    if (lidRef.current) {
      lidRef.current.rotation.x =
        (Math.cos(Math.max(offset - lidDelay, 0)) * -0.5 + 0.5) * -8 * Math.PI;
    }
    if (tabRef.current) {
      tabRef.current.rotation.x = Math.atan(offset) * -1 * Math.PI;
    }
    if (rightTabRef.current) {
      rightTabRef.current.rotation.y =
        0 +
        (Math.cos(Math.max(offset - lidDelay, 0)) * -0.5 + 0.5) * 2 * Math.PI;
    }
    if (leftTabRef.current) {
      leftTabRef.current.rotation.y =
        0 -
        (Math.cos(Math.max(offset - lidDelay, 0)) * -0.5 + 0.5) * 2 * Math.PI;
    }
  });

  const props = useTexture({
    map: "Paper004_1K-JPG_Color.jpg",
    normalMap: "Paper004_1K-JPG_NormalDX.jpg",
    roughnessMap: "Paper004_1K-JPG_Roughness.jpg",
  });

  const textureScaleY = 1 / WIDTH;
  const textureScaleX = 1 / HEIGHT;
  props.map.wrapS = THREE.RepeatWrapping;
  props.map.wrapT = THREE.RepeatWrapping;
  props.map.repeat.set(HEIGHT * textureScaleX, WIDTH * textureScaleY);

  return (
    <group ref={lidRef} position={[0, HEIGHT, -WIDTH / 2 + THICKNESS]}>
      <Panel
        pos={new THREE.Vector3(0, 0, WIDTH / 2)}
        rotation={new THREE.Euler(Math.PI / 2, 0, 0)}
        width={WIDTH}
        height={WIDTH + THICKNESS}
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
          {...props}
          position={[WIDTH / 2, 0, 0]}
          rotation={new THREE.Euler(Math.PI, 0, Math.PI / 2)}
        >
          {/* <circleGeometry args={[HEIGHT, undefined, undefined, Math.PI / 2]} /> */}
          <cylinderGeometry
            args={[
              HEIGHT,
              HEIGHT,
              0.05,
              undefined,
              undefined,
              undefined,
              0,
              Math.PI / 2,
            ]}
          />
          <meshStandardMaterial
            map={props.map}
            color="#ffffff"
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh
          ref={leftTabRef}
          {...props}
          position={[-WIDTH / 2, 0, 0]}
          rotation={new THREE.Euler(Math.PI, 0, Math.PI / 2)}
        >
          {/* <circleGeometry args={[HEIGHT, undefined, undefined, Math.PI / 2]} /> */}
          <cylinderGeometry
            args={[
              HEIGHT,
              HEIGHT,
              0.05,
              undefined,
              undefined,
              undefined,
              0,
              Math.PI / 2,
            ]}
          />
          <meshStandardMaterial
            map={props.map}
            color="#ffffff"
            side={THREE.DoubleSide}
          />
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
        width={WIDTH - THICKNESS}
        height={HEIGHT}
      />
      {/* Front panel */}
      <Panel
        pos={new THREE.Vector3(0, HEIGHT / 2, WIDTH / 2)}
        rotation={new THREE.Euler(0, 0, 0)}
        width={WIDTH - THICKNESS}
        height={HEIGHT}
      />
      {/* Left panel */}
      <Panel
        pos={new THREE.Vector3(-WIDTH / 2, HEIGHT / 2, 0)}
        rotation={new THREE.Euler(0, Math.PI / 2, 0)}
        width={WIDTH + THICKNESS}
        height={HEIGHT}
      />
      {/* Right panel */}
      <Panel
        pos={new THREE.Vector3(WIDTH / 2, HEIGHT / 2, 0)}
        rotation={new THREE.Euler(0, -Math.PI / 2, 0)}
        width={WIDTH + THICKNESS}
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

export const Box = () => {
  return (
    <>
      <BoxLid />
      <BoxBottom />
    </>
  );
};

export const Mat = () => {
  const matProps = useTexture({
    map: "Carpet006_1K-JPG_Color.jpg",
    displacementMap: "Carpet006_1K-JPG_Displacement.jpg",
    normalMap: "Carpet006_1K-JPG_NormalDX.jpg",
    roughnessMap: "Carpet006_1K-JPG_Roughness.jpg",
    aoMap: "Carpet006_1K-JPG_AmbientOcclusion.jpg",
  });

  const floorProps = useTexture({
    map: "Wood051_1K-JPG_Color.jpg",
    // displacementMap: "Wood051_1K-JPG_Displacement.jpg",
    normalMap: "Wood051_1K-JPG_NormalDX.jpg",
    roughnessMap: "Wood051_1K-JPG_Roughness.jpg",
    // aoMap: "Wood051_1K-JPG_AmbientOcclusion.jpg",
  });
  return (
    <group>
      {/* <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <planeGeometry args={[20, 15]} />
        <meshStandardMaterial {...matProps} />
      </mesh> */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        {/* <planeGeometry args={[50, 40]} /> */}
        <boxGeometry args={[50, 40, 1]} />
        <meshToonMaterial {...floorProps} />
      </mesh>
    </group>
  );
};
