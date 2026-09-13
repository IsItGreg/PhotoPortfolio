import config from "./sceneConfig.json";
import { LabelSpec, Vec3 } from "./sceneTypes";
import BakedLabel from "./BakedLabel";

// A build-time branch, not a URL/runtime flag: Troika and the editor must not
// enter the production dependency graph.
const Label: typeof BakedLabel =
  process.env.NODE_ENV === "production"
    ? BakedLabel
    : require("./authoring/EditableLabel").default;

export default function BoxLabels({ lidDepth }: { lidDepth: number }) {
  const draw = (label: LabelSpec) => (
    <group
      key={label.id}
      position={[
        label.position[0],
        label.position[1],
        label.surface === "outside" ? lidDepth / 2 : label.position[2],
      ]}
      rotation={label.rotation as Vec3}
      scale={label.scale}
    >
      <Label label={label} />
    </group>
  );
  return (
    <>
      {config.labels.filter((label) => label.surface === "outside").map(draw)}
      <group
        position={config.insideLabelGroup.position as Vec3}
        rotation={config.insideLabelGroup.rotation as Vec3}
      >
        {config.labels.filter((label) => label.surface === "inside").map(draw)}
      </group>
    </>
  );
}
