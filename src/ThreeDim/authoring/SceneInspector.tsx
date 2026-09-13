import { Html, OrbitControls, useScroll } from "@react-three/drei";
import { SceneInspection, defaultInspection } from "../sceneTypes";

export default function SceneInspector({
  value,
  onChange,
}: {
  value: SceneInspection;
  onChange: (value: SceneInspection) => void;
}) {
  const scroll = useScroll();
  const set = (change: Partial<SceneInspection>) =>
    onChange({ ...value, ...change });
  return (
    <>
      {value.orbit && <OrbitControls makeDefault target={[0, 0, -4]} />}
      <Html fullscreen style={{ pointerEvents: "none" }}>
        <details
          style={{
            position: "absolute",
            bottom: 28,
            left: 16,
            pointerEvents: "auto",
            width: 240,
            background: "#151515ed",
            color: "white",
            border: "1px solid #555",
            borderRadius: 8,
            fontFamily: "system-ui",
            fontSize: 12,
            padding: 12,
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <summary style={{ cursor: "pointer" }}>
            Box studio · development only
          </summary>
          <p style={{ margin: "12px 0" }}>Full editable rig · live lettering</p>
          <label style={{ display: "block", margin: "8px 0" }}>
            Pose{" "}
            <select
              style={{ color: "black" }}
              value={value.pose}
              onChange={(event) =>
                set(
                  event.target.value === "flat"
                    ? { pose: "flat", hidePhotos: true, orbit: true }
                    : { pose: "scroll", orbit: false, hidePhotos: false },
                )
              }
            >
              <option value="scroll">Normal opening / closing</option>
              <option value="flat">Unfolded sheet</option>
            </select>
          </label>
          {value.pose === "scroll" && (
            <label style={{ display: "block", margin: "8px 0" }}>
              Opening progress
              <input
                aria-label="Opening progress"
                type="range"
                min="0"
                max="100"
                defaultValue="0"
                style={{ width: "100%" }}
                onChange={(event) => {
                  scroll.el.scrollTop =
                    (Number(event.target.value) / 100) *
                    (scroll.el.scrollHeight - scroll.el.clientHeight);
                }}
              />
            </label>
          )}
          {(
            [
              ["wireframe", "Wireframe"],
              ["hidePhotos", "Hide photos"],
              ["orbit", "Orbit camera"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ display: "block", margin: "8px 0" }}>
              <input
                type="checkbox"
                checked={value[key]}
                onChange={(event) => set({ [key]: event.target.checked })}
              />{" "}
              {label}
            </label>
          ))}
          <button
            onClick={() => onChange(defaultInspection)}
            style={{
              border: "1px solid #777",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            Return to site view
          </button>
          <p style={{ marginTop: 12 }}>
            Edit sceneConfig.json for labels and lighting. Edit the authoring
            GLB for panels and folds. Nothing here is published.
          </p>
        </details>
      </Html>
    </>
  );
}
