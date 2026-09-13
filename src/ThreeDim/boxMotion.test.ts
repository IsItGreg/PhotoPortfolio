import fs from "fs";
import path from "path";
import * as THREE from "three";
import { createBoxScrollTimeline } from "./boxMotion";
import pacing from "./boxScrollPacing.json";

// Read the actual shipped animation without requiring browser texture decode.
function shippedOpeningClip() {
  const bytes = fs.readFileSync(
    path.join(process.cwd(), "public/models/cardboard-mailer.glb"),
  );
  const jsonLength = bytes.readUInt32LE(12);
  const asset = JSON.parse(
    bytes.subarray(20, 20 + jsonLength).toString("utf8"),
  );
  expect(asset.meshes).toHaveLength(2);
  expect(
    asset.meshes.reduce(
      (sum: number, mesh: { primitives: unknown[] }) =>
        sum + mesh.primitives.length,
      0,
    ),
  ).toBe(4);
  expect(asset.skins).toHaveLength(1);
  expect(asset.skins[0].joints).toHaveLength(7);
  expect(
    asset.animations.map((animation: { name: string }) => animation.name),
  ).toEqual(["Open_Lid", "Close_Lid"]);
  const binaryStart = 20 + jsonLength + 8;
  const accessorValues = (index: number) => {
    const accessor = asset.accessors[index];
    const view = asset.bufferViews[accessor.bufferView];
    expect(accessor.componentType).toBe(5126);
    expect(view.byteStride).toBeUndefined();
    const size = accessor.type === "VEC4" ? 4 : 1;
    const offset =
      binaryStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    return Array.from({ length: accessor.count * size }, (_, i) =>
      bytes.readFloatLE(offset + i * 4),
    );
  };
  const animation = asset.animations.find(
    (item: { name: string }) => item.name === "Open_Lid",
  );
  const tracks = animation.channels.map(
    (channel: { sampler: number; target: { node: number; path: string } }) => {
      expect(channel.target.path).toBe("rotation");
      const sampler = animation.samplers[channel.sampler];
      expect(sampler.interpolation).toBe("LINEAR");
      return new THREE.QuaternionKeyframeTrack(
        `${asset.nodes[channel.target.node].name}.quaternion`,
        accessorValues(sampler.input),
        accessorValues(sampler.output),
      );
    },
  );
  return new THREE.AnimationClip("Open_Lid", -1, tracks);
}

const clip = shippedOpeningClip();
const timeAtScroll = createBoxScrollTimeline(clip);
const hinges = [
  "CTRL_Lid",
  "CTRL_TuckFlap",
  "CTRL_TuckEar_L",
  "CTRL_LidWing_L",
];
const interpolants = hinges.map((name) =>
  clip.tracks
    .find((track) => track.name === `${name}.quaternion`)!
    .createInterpolant(),
);
const poseAt = (time: number) =>
  interpolants.map((interpolant) =>
    new THREE.Quaternion().fromArray(interpolant.evaluate(time)).normalize(),
  );

test("continuous, monotonic full-range scrubbing with deterministic reverse motion", () => {
  expect(timeAtScroll(-1)).toBe(0);
  expect(timeAtScroll(0)).toBe(0);
  expect(timeAtScroll(1)).toBe(clip.duration);
  expect(timeAtScroll(2)).toBe(clip.duration);
  expect(timeAtScroll(NaN)).toBe(0);
  const times = Array.from({ length: 1001 }, (_, i) => timeAtScroll(i / 1000));
  times.slice(1).forEach((time, i) => {
    expect(time).toBeGreaterThan(times[i]);
    expect(time - times[i]).toBeLessThan(clip.duration * 0.015);
  });
  times
    .slice()
    .reverse()
    .forEach((time, i) => {
      expect(timeAtScroll((1000 - i) / 1000)).toBe(time);
    });
});

test("begins with gradual front-flap motion and preserves the shared clearance sequence", () => {
  const early = poseAt(timeAtScroll(0.2));
  expect(early[1].angleTo(poseAt(0)[1])).toBeGreaterThan((20 * Math.PI) / 180);
  expect(early[0].angleTo(poseAt(0)[0])).toBeLessThan(Math.PI / 180);
  for (let i = 0; i <= 1000; i += 1) {
    const [lid, tuck, ear, wing] = poseAt(timeAtScroll(i / 1000));
    const lidAngle = lid.angleTo(new THREE.Quaternion());
    expect(tuck.angleTo(new THREE.Quaternion())).toBeLessThanOrEqual(
      (80.01 * Math.PI) / 180,
    );
    if (lidAngle < (13 * Math.PI) / 180) {
      expect(ear.angleTo(poseAt(0)[2])).toBeLessThan(Math.PI / 180);
    }
    if (lidAngle < (93 * Math.PI) / 180) {
      expect(wing.angleTo(new THREE.Quaternion())).toBeLessThan(Math.PI / 180);
    }
  }
  expect(
    poseAt(timeAtScroll(1))[1].angleTo(new THREE.Quaternion()),
  ).toBeCloseTo(Math.PI / 3, 5);
  expect(
    poseAt(timeAtScroll(1))[3].angleTo(new THREE.Quaternion()),
  ).toBeCloseTo((25 * Math.PI) / 180, 5);
  expect(poseAt(timeAtScroll(1))[2].angleTo(poseAt(0)[2])).toBeCloseTo(
    (25 * Math.PI) / 180,
    5,
  );
});

test("substantially reduces the rotation bursts of the previous scroll mapping", () => {
  const oldTimeAtScroll = (offset: number) => {
    const x = THREE.MathUtils.clamp((offset - 0.32) / 0.68, 0, 1);
    return x * x * x * (x * (x * 6 - 15) + 10) * clip.duration;
  };
  const peakSpeeds = (timeAt: (scroll: number) => number) => {
    let previous = poseAt(timeAt(0));
    const peaks = [0, 0, 0, 0];
    for (let i = 1; i <= 2000; i += 1) {
      const current = poseAt(timeAt(i / 2000));
      current.forEach((rotation, hinge) => {
        peaks[hinge] = Math.max(
          peaks[hinge],
          rotation.angleTo(previous[hinge]) * 2000,
        );
      });
      previous = current;
    }
    return peaks;
  };
  const before = peakSpeeds(oldTimeAtScroll);
  const after = peakSpeeds(timeAtScroll);
  after.forEach((speed, hinge) =>
    expect(speed).toBeLessThan(before[hinge] * 0.65),
  );
  expect(after[2]).toBeLessThan(before[2] * 0.4);
});

test("does not rewrite the asset's animation tracks", () => {
  const before = THREE.AnimationClip.toJSON(clip);
  createBoxScrollTimeline(clip)(0.5);
  expect(THREE.AnimationClip.toJSON(clip)).toEqual(before);
});

test("ear pose changes cannot stretch the shared scroll cadence", () => {
  const wider = clip.clone();
  const ear = wider.tracks.find(
    (track) => track.name === "CTRL_TuckEar_L.quaternion",
  )!;
  for (let i = 0; i < ear.values.length; i += 4) {
    const rotation = new THREE.Quaternion()
      .fromArray(ear.values, i)
      .normalize();
    const angle = new THREE.Euler().setFromQuaternion(rotation).y;
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle / 2);
    rotation.toArray(ear.values, i);
  }
  const widerTime = createBoxScrollTimeline(wider);
  for (let i = 0; i <= 100; i += 1) {
    expect(Math.abs(timeAtScroll(i / 100) - widerTime(i / 100))).toBeLessThan(
      0.0001,
    );
  }
});

test("ears flare briefly, then settle inward well before the lid is fully open", () => {
  let peak = 0;
  let widelyOpenSamples = 0;
  for (let i = 0; i <= 1000; i += 1) {
    const [lid, , ear] = poseAt(timeAtScroll(i / 1000));
    const spread = (ear.angleTo(poseAt(0)[2]) * 180) / Math.PI;
    const lift = (lid.angleTo(new THREE.Quaternion()) * 180) / Math.PI;
    peak = Math.max(peak, spread);
    if (spread > 40) widelyOpenSamples += 1;
    if (lift >= 70) expect(spread).toBeCloseTo(25, 2);
  }
  expect(peak).toBeGreaterThan(43);
  expect(peak).toBeLessThanOrEqual(45.01);
  expect(widelyOpenSamples / 1001).toBeLessThan(0.14);
});

test("baked pacing is finite, monotonic, and covers the complete clip", () => {
  const values = pacing.normalizedClipTimes;
  expect(values).toHaveLength(513);
  expect(values[0]).toBe(0);
  expect(values[512]).toBe(1);
  values.slice(1).forEach((value, i) => {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(values[i]);
  });
});
