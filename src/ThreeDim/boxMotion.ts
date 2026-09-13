import * as THREE from "three";
import pacing from "./boxScrollPacing.json";

/** Scrub the accepted scroll cadence independently of individual flap poses. */
export function createBoxScrollTimeline(clip: THREE.AnimationClip) {
  if (!(clip.duration > 0)) throw new Error("Box opening clip has no duration");
  // Baked from the accepted v8 cadence. Recomputing pace from ear motion
  // would slow the whole lid down when adding the ears' inward settling.
  // The compact lookup matches the former pacing within 0.025 degrees.
  const times = pacing.normalizedClipTimes;
  const last = times.length - 1;
  return (offset: number): number => {
    const scroll = THREE.MathUtils.clamp(
      Number.isFinite(offset) ? offset : 0,
      0,
      1,
    );
    const index = scroll * last;
    const lower = Math.min(Math.floor(index), last - 1);
    return (
      THREE.MathUtils.lerp(times[lower], times[lower + 1], index - lower) *
      clip.duration
    );
  };
}
