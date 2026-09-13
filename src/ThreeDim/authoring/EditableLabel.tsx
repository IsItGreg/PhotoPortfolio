import { Text } from "@react-three/drei";
import { LabelSpec } from "../sceneTypes";
import assets from "./assets";

export default function EditableLabel({ label }: { label: LabelSpec }) {
  return (
    <Text
      font={assets.font}
      fontSize={label.fontSize}
      lineHeight={
        label.lineHeight === "normal" ? undefined : Number(label.lineHeight)
      }
      color="white"
      anchorX="center"
      anchorY="middle"
      textAlign="center"
    >
      {label.text}
    </Text>
  );
}
