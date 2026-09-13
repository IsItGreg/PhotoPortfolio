import { createPortal, useFrame, useLoader } from "@react-three/fiber";
import { useScroll, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createBoxScrollTimeline } from "./boxMotion";
import BoxLabels from "./BoxLabels";
import { sceneAssets } from "./sceneAssets";
import config from "./sceneConfig.json";
import { defaultInspection, SceneInspection } from "./sceneTypes";

const DISPLAY_WIDTH = config.displayWidth;
const MODEL_WIDTH_METERS = config.modelWidthInches * 0.0254;
const MODEL_SCALE = DISPLAY_WIDTH / MODEL_WIDTH_METERS;
const MODEL_URL = sceneAssets.model;

type BoxControls = {
  lid: THREE.Object3D;
  tuck: THREE.Object3D;
  leftEar: THREE.Object3D;
  rightEar: THREE.Object3D;
  leftWing: THREE.Object3D;
  rightWing: THREE.Object3D;
};

const requiredNode = (root: THREE.Object3D, name: string) => {
  const node = root.getObjectByName(name);
  if (!node) {
    throw new Error(`Cardboard box is missing required rig control: ${name}`);
  }
  return node;
};

const RiggedCardboardBox = ({
  inspection,
}: {
  inspection: SceneInspection;
}) => {
  const scroll = useScroll();
  const { scene, animations } = useLoader(GLTFLoader, MODEL_URL);
  // The tray is baked; moving panels/liners share a compact skin. Clone its
  // skeleton so the hinges belong to this instance rather than the GLTF cache.
  const model = useMemo(() => {
    const instance = cloneSkeleton(scene);
    // Inspector material changes must not mutate the shared loader cache.
    instance.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = Array.isArray(child.material)
          ? child.material.map((material) => material.clone())
          : child.material.clone();
      }
    });
    return instance;
  }, [scene]);

  useEffect(
    () => () =>
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((material) => material.dispose());
        }
      }),
    [model],
  );

  const controls = useMemo<BoxControls>(
    () => ({
      lid: requiredNode(model, "CTRL_Lid"),
      tuck: requiredNode(model, "CTRL_TuckFlap"),
      leftEar: requiredNode(model, "CTRL_TuckEar_L"),
      rightEar: requiredNode(model, "CTRL_TuckEar_R"),
      leftWing: requiredNode(model, "CTRL_LidWing_L"),
      rightWing: requiredNode(model, "CTRL_LidWing_R"),
    }),
    [model],
  );

  // Drive the same exported clip used by the verified model and chat preview.
  // This keeps flap extraction, ear release and lid/wing timing in one place.
  const motion = useMemo(() => {
    const clip = animations.find((animation) => animation.name === "Open_Lid");
    if (!clip)
      throw new Error("Cardboard box is missing its opening animation");
    return {
      mixer: new THREE.AnimationMixer(model),
      clip,
      timeAtScroll: createBoxScrollTimeline(clip),
    };
  }, [animations, model]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    const action = motion.mixer.clipAction(motion.clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.paused = true;
    actionRef.current = action;
    return () => {
      actionRef.current = null;
      motion.mixer.stopAllAction();
      motion.mixer.uncacheRoot(model);
    };
  }, [motion, model]);

  const displayLidDepth =
    (Number(controls.lid.userData.depthInches) || 7) * 0.0254 * MODEL_SCALE;

  useEffect(() => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // The fold strips can move far from their flat-sheet bind bounds.
        if (child instanceof THREE.SkinnedMesh) child.frustumCulled = false;
        child.castShadow = true;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.wireframe = inspection.wireframe;
            [
              material.map,
              material.normalMap,
              material.roughnessMap,
              material.aoMap,
            ].forEach((texture) => {
              if (texture) {
                // Preserve fine paper detail when the box is viewed obliquely.
                texture.anisotropy = Math.max(texture.anisotropy, 8);
                texture.needsUpdate = true;
              }
            });
          }
        });
      }
    });
  }, [model, inspection.wireframe]);

  useFrame(() => {
    // Let the front flap ease out during the approach, as in the original box.
    // ScrollControls already damps input; keep every hinge on one shared clock.
    if (inspection.pose === "flat") {
      model.traverse((node) => {
        if (Array.isArray(node.userData.flatRotation)) {
          node.quaternion.fromArray(node.userData.flatRotation);
        }
      });
    } else if (actionRef.current) {
      actionRef.current.time = motion.timeAtScroll(scroll.offset);
      motion.mixer.update(0);
    }
  });

  return (
    <>
      <primitive object={model} scale={MODEL_SCALE} />
      {createPortal(
        <group scale={1 / MODEL_SCALE}>
          <BoxLabels lidDepth={displayLidDepth} />
        </group>,
        controls.lid,
      )}
    </>
  );
};

export const Box = ({
  inspection = defaultInspection,
}: {
  inspection?: SceneInspection;
}) => {
  const scroll = useScroll();
  const handleBoxClick = () => {
    if (scroll.el && scroll.offset < 1) {
      scroll.el.scrollTo({
        top: scroll.el.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <group
      onClick={handleBoxClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        if (scroll.offset < 1) {
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        if (scroll.offset < 1) {
          document.body.style.cursor = "default";
        }
      }}
    >
      <RiggedCardboardBox key={inspection.pose} inspection={inspection} />
    </group>
  );
};

useLoader.preload(GLTFLoader, MODEL_URL);

export const Mat = () => {
  const floorProps = useTexture({
    map: sceneAssets.woodColor,
    normalMap: sceneAssets.woodNormal,
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <boxGeometry args={[50, 40, 1]} />
        <meshToonMaterial {...floorProps} />
      </mesh>
    </group>
  );
};
