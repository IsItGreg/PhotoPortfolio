import { useTexture } from "@react-three/drei";
import { useEffect } from "react";
import { SRGBColorSpace } from "three";
import baked from "./generated/scene-assets.json";
import { LabelSpec } from "./sceneTypes";

export default function BakedLabel({ label }: { label: LabelSpec }) {
  const asset = baked.labels.find((item) => item.id === label.id);
  if (!asset)
    throw new Error(`Missing baked label ${label.id}; run npm run scene:bake`);
  return <LabelPlane asset={asset} />;
}

function LabelPlane({ asset }: { asset: (typeof baked.labels)[number] }) {
  const texture = useTexture(asset.url);
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);
  return (
    <mesh position={[asset.center[0], asset.center[1], 0]}>
      <planeGeometry args={[asset.width, asset.height]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
