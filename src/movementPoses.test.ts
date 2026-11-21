import { expect, test } from "vite-plus/test";
import { anatomy, distance, ground, motionPhaseFor, motionPosesFor, movementDurations, poseFor } from "./movementPoses";
import type { Limb, Phase, Point } from "./movementPoses";
import type { Movement } from "./workouts";

const movements: Exclude<Movement, "rest">[] = [
  "squat",
  "march",
  "circles",
  "pushup",
  "pike-pushup",
  "lunge",
  "goblet-lunge",
  "press",
  "crunch",
  "row",
  "prone-w",
  "bridge",
  "curl",
  "self-resisted-curl",
  "plank",
];
const phases: Phase[] = [0, 1, 2];
function angle([a, b, c]: Limb) {
  const dot = (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]);
  return (Math.acos(Math.max(-1, Math.min(1, dot / (distance(a, b) * distance(b, c))))) * 180) / Math.PI;
}
function parallel(a: Point, b: Point, c: Point, d: Point) {
  return (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
}

test.each(movements)("%s keeps the same adult proportions in every pose", (movement) => {
  for (const pose of motionPosesFor(movement)) {
    for (const limb of pose.arms) {
      expect(distance(limb[0], limb[1])).toBeCloseTo(anatomy.upperArm, 8);
      expect(distance(limb[1], limb[2])).toBeCloseTo(anatomy.forearm, 8);
    }
    for (const [index, limb] of pose.legs.entries()) {
      expect(distance(limb[0], limb[1])).toBeCloseTo(anatomy.thigh, 8);
      expect(distance(limb[1], limb[2])).toBeCloseTo(anatomy.shin, 8);
      expect(distance(limb[2], pose.toes[index])).toBeCloseTo(anatomy.foot, 8);
    }
    expect(distance(pose.spine[0], pose.spine[1])).toBeCloseTo(anatomy.upperBack, 8);
    expect(distance(pose.spine[1], pose.spine[2])).toBeCloseTo(anatomy.lowerBack, 8);
    expect(distance(pose.spine[0], pose.head)).toBeCloseTo(anatomy.neckToHead, 8);
    for (const point of [pose.head, ...pose.spine, ...pose.arms.flat(), ...pose.legs.flat(), ...pose.toes]) {
      expect(Number.isFinite(point[0]) && Number.isFinite(point[1])).toBe(true);
      expect(point[0]).toBeGreaterThan(20);
      expect(point[0]).toBeLessThan(240);
      expect(point[1]).toBeGreaterThan(12);
      expect(point[1]).toBeLessThanOrEqual(ground);
    }
    if (pose.bell) expect(pose.bell.grip[1] + 23).toBeLessThan(ground);
  }
});

test.each(movements)("%s has a closed, continuous cycle with no jumps between samples", (movement) => {
  const poses = motionPosesFor(movement);
  expect(poses.at(-1)).toEqual(poses[0]);
  for (let index = 1; index < poses.length; index++) {
    const before = poses[index - 1];
    const after = poses[index];
    const previousPoints = [before.head, ...before.spine, ...before.arms.flat(), ...before.legs.flat(), ...before.toes];
    const nextPoints = [after.head, ...after.spine, ...after.arms.flat(), ...after.legs.flat(), ...after.toes];
    expect(
      Math.max(...nextPoints.map((point, pointIndex) => distance(point, previousPoints[pointIndex]))),
    ).toBeLessThan(12);
  }
});

test("floor and bench supports remain planted throughout the continuous motion", () => {
  for (const movement of ["pushup", "pike-pushup", "lunge", "goblet-lunge", "row", "bridge", "squat"] as const) {
    const poses = motionPosesFor(movement);
    const start = poses[0];
    for (const pose of poses) {
      if (movement === "pushup" || movement === "pike-pushup") {
        expect(pose.toes).toEqual(start.toes);
        expect(pose.arms.map((arm) => arm[2])).toEqual(start.arms.map((arm) => arm[2]));
      }
      if (movement === "squat" || movement === "row") expect(pose.toes).toEqual(start.toes);
      if (movement === "lunge" || movement === "goblet-lunge" || movement === "bridge")
        expect(pose.toes[1]).toEqual(start.toes[1]);
      if (movement === "row") expect(pose.arms[0][2]).toEqual(start.arms[0][2]);
      if (movement === "bridge") {
        expect(pose.head).toEqual(start.head);
        expect(pose.spine[0]).toEqual(start.spine[0]);
      }
    }
  }
});

test("push-ups keep a straight body, planted hands and toes, and bend at the elbows", () => {
  const start = poseFor("pushup", 0);
  const bottom = poseFor("pushup", 2);
  for (const phase of phases) {
    const pose = poseFor("pushup", phase);
    expect(pose.toes).toEqual(start.toes);
    expect(pose.arms.map((limb) => limb[2])).toEqual(start.arms.map((limb) => limb[2]));
    expect(parallel(pose.spine[0], pose.spine[2], pose.legs[1][0], pose.legs[1][2])).toBeCloseTo(0, 8);
    expect(angle(pose.legs[1])).toBeCloseTo(180, 5);
  }
  expect(angle(start.arms[1])).toBeGreaterThan(155);
  expect(angle(bottom.arms[1])).toBeGreaterThan(75);
  expect(angle(bottom.arms[1])).toBeLessThan(100);
});

test("reverse lunges return to standing while the working foot stays planted", () => {
  const start = poseFor("lunge", 0);
  const bottom = poseFor("lunge", 2);
  for (const phase of phases) expect(poseFor("lunge", phase).toes[1]).toEqual(start.toes[1]);
  expect(bottom.toes[0][0] - start.toes[0][0]).toBeGreaterThan(50);
  expect(bottom.legs[0][1][1]).toBeGreaterThan(180); // rear knee just above the floor
  expect(bottom.legs[0][1][1]).toBeLessThan(ground - 3);
  expect(bottom.legs[0][2][1]).toBeLessThan(start.legs[0][2][1]); // rear heel rises
  expect(angle(bottom.legs[1])).toBeGreaterThan(75);
  expect(angle(bottom.legs[1])).toBeLessThan(105);
  expect(bottom.bell).toBeUndefined();
  const loaded = poseFor("goblet-lunge", 2);
  expect(loaded.legs).toEqual(bottom.legs);
  for (const hand of loaded.arms.map((limb) => limb[2]))
    expect(distance(hand, loaded.bell!.grip)).toBeLessThanOrEqual(5);
});

test("pike push-ups keep the hips above the shoulders while the head lowers", () => {
  const start = poseFor("pike-pushup", 0);
  const bottom = poseFor("pike-pushup", 2);
  expect(bottom.spine[2][1]).toBeLessThan(bottom.spine[0][1]);
  expect(bottom.head[1]).toBeGreaterThan(start.head[1] + 15);
  expect(angle(bottom.arms[1])).toBeLessThan(angle(start.arms[1]));
});

test("bodyweight curl maintains hand contact on the working forearm", () => {
  for (const pose of motionPosesFor("self-resisted-curl")) {
    const [, elbow, wrist] = pose.arms[1];
    expect(distance(elbow, pose.arms[0][2])).toBeCloseTo(anatomy.forearm * (2 / 3));
    expect(distance(pose.arms[0][2], wrist)).toBeCloseTo(anatomy.forearm / 3);
    expect(pose.bell).toBeUndefined();
  }
});

test("prone W moves both arms symmetrically over a stationary body", () => {
  const start = poseFor("prone-w", 0);
  const peak = poseFor("prone-w", 2);
  expect(peak.support).toBe("overhead-mat");
  expect(peak.spine).toEqual(start.spine);
  expect(peak.legs).toEqual(start.legs);
  for (const [index, [, elbow, wrist]] of peak.arms.entries()) {
    expect(wrist[1]).toBeLessThan(elbow[1]);
    expect(elbow[1]).toBeLessThan(start.arms[index][1][1]);
  }
});

test("marching alternates the raised knee while the other foot supports an upright torso", () => {
  const standing = poseFor("march", 1);
  for (const phase of phases) {
    const pose = poseFor("march", phase);
    expect(pose.spine).toEqual(standing.spine);
    expect(pose.spine[0][0]).toBeCloseTo(pose.spine[2][0], 8);
  }
  const leftUp = poseFor("march", 0);
  const rightUp = poseFor("march", 2);
  expect(leftUp.toes[1]).toEqual(standing.toes[1]);
  expect(rightUp.toes[0]).toEqual(standing.toes[0]);
  expect(leftUp.legs[0][1][1]).toBeLessThan(standing.legs[0][1][1] - 35);
  expect(rightUp.legs[1][1][1]).toBeLessThan(standing.legs[1][1][1] - 35);
  expect(leftUp.arms[1][2][0]).toBeLessThan(rightUp.arms[1][2][0]);
  expect(rightUp.arms[0][2][0]).toBeLessThan(leftUp.arms[0][2][0]);
});

test("single-leg bridges lift the pelvis without moving the head, shoulders or working foot", () => {
  const start = poseFor("bridge", 0);
  const top = poseFor("bridge", 2);
  for (const phase of phases) {
    const pose = poseFor("bridge", phase);
    expect(pose.support).toBe("mat");
    expect(pose.head).toEqual(start.head);
    expect(pose.spine[0]).toEqual(start.spine[0]);
    expect(pose.arms).toEqual(start.arms);
    expect(pose.legs[1][2]).toEqual(start.legs[1][2]);
    expect(pose.toes[1]).toEqual(start.toes[1]);
    expect(pose.toes[0][1]).toBeLessThan(ground - 40);
    expect(parallel(pose.spine[0], pose.spine[1], pose.spine[1], pose.spine[2])).toBeCloseTo(0, 8);
  }
  expect(top.spine[2][1]).toBeLessThan(start.spine[2][1] - 14);
  expect(parallel(top.spine[0], top.spine[2], top.legs[1][0], top.legs[1][1])).toBeCloseTo(0, 8);
  expect(top.legs[1][1][0]).toBeCloseTo(top.legs[1][2][0], 8);
});

test("the curl keeps its elbow and torso fixed instead of swinging the weight", () => {
  const start = poseFor("curl", 0);
  for (const phase of phases) {
    const pose = poseFor("curl", phase);
    expect(pose.spine).toEqual(start.spine);
    expect(pose.legs).toEqual(start.legs);
    expect(pose.arms[1].slice(0, 2)).toEqual(start.arms[1].slice(0, 2));
    expect(pose.bell!.grip).toEqual(pose.arms[1][2]);
  }
  expect(angle(poseFor("curl", 2).arms[1])).toBeLessThan(45);
});

test("the press finishes stacked overhead without leaning back or lifting the feet", () => {
  const start = poseFor("press", 0);
  const lockout = poseFor("press", 2);
  for (const phase of phases) {
    const pose = poseFor("press", phase);
    expect(pose.spine).toEqual(start.spine);
    expect(pose.toes).toEqual(start.toes);
    expect(pose.arms[1][1][0]).toBeCloseTo(pose.arms[1][2][0], 8);
    expect(pose.bell!.grip).toEqual(pose.arms[1][2]);
    expect(pose.bell!.rotation).toBeLessThan(0); // normal rack, not a bottoms-up press
  }
  expect(angle(lockout.arms[1])).toBeCloseTo(180, 5);
  expect(lockout.arms[1][2][0]).toBeCloseTo(lockout.shoulders[1][0], 8);
});

test("the row braces the free hand on a support and moves only the loaded arm", () => {
  const start = poseFor("row", 0);
  const finish = poseFor("row", 2);
  for (const phase of phases) {
    const pose = poseFor("row", phase);
    expect(pose.support).toBe("bench");
    expect(pose.spine).toEqual(start.spine);
    expect(pose.arms[0]).toEqual(start.arms[0]);
    expect(pose.toes).toEqual(start.toes);
    expect(pose.bell!.grip).toEqual(pose.arms[1][2]);
  }
  expect(finish.arms[1][1][0]).toBeGreaterThan(start.arms[1][1][0] + 20);
  expect(finish.bell!.grip[1]).toBeLessThan(start.bell!.grip[1] - 20);
});

test("reverse crunches lift the pelvis while the head, shoulders, and knee bend stay fixed", () => {
  const start = poseFor("crunch", 0);
  const finish = poseFor("crunch", 2);
  for (const phase of phases) {
    const pose = poseFor("crunch", phase);
    expect(pose.head).toEqual(start.head);
    expect(pose.spine[0]).toEqual(start.spine[0]);
    expect(pose.arms).toEqual(start.arms);
    for (const limb of pose.legs) expect(angle(limb)).toBeCloseTo(90, 6);
  }
  expect(finish.spine[2][1]).toBeLessThan(start.spine[2][1] - 10);
  expect(distance(finish.spine[0], finish.spine[2])).toBeLessThan(distance(start.spine[0], start.spine[2]));
});

test("side plank is an isometric forearm hold with the elbow directly under the shoulder", () => {
  const pose = poseFor("plank", 0);
  expect(poseFor("plank", 1)).toEqual(pose);
  expect(poseFor("plank", 2)).toEqual(pose);
  const [shoulder, elbow, wrist] = pose.arms[0];
  expect(shoulder[0]).toBeCloseTo(elbow[0], 8);
  expect(elbow[1]).toBeCloseTo(wrist[1], 8);
  expect(elbow[1]).toBeCloseTo(186, 8);
  expect(angle(pose.arms[0])).toBeCloseTo(90, 8);
  for (const limb of pose.legs) expect(angle(limb)).toBeCloseTo(180, 5);
  expect(pose.legs[0][2][1] - pose.legs[1][2][1]).toBeCloseTo(6, 8);
});

test("squats keep the feet grounded and reach approximately parallel thighs", () => {
  const start = poseFor("squat", 0);
  const bottom = poseFor("squat", 2);
  for (const phase of phases) expect(poseFor("squat", phase).toes).toEqual(start.toes);
  expect(bottom.spine[2][1] - start.spine[2][1]).toBeGreaterThan(30);
  expect(Math.abs(bottom.legs[1][0][1] - bottom.legs[1][1][1])).toBeLessThan(6);
});

test("arm circles rotate straight arms around fixed shoulders without moving the torso", () => {
  const start = poseFor("circles", 0);
  for (const phase of phases) {
    const pose = poseFor("circles", phase);
    expect(pose.spine).toEqual(start.spine);
    expect(pose.legs).toEqual(start.legs);
    for (const limb of pose.arms) {
      expect(angle(limb)).toBeCloseTo(180, 5);
      expect(distance(limb[0], limb[2])).toBeCloseTo(anatomy.upperArm + anatomy.forearm, 8);
    }
  }
  const hands = phases.map((phase) => poseFor("circles", phase).arms[1][2]);
  expect(Math.abs(parallel(hands[0], hands[1], hands[1], hands[2]))).toBeGreaterThan(1000);
});

test("supine exercises orient the mirrored profile head upward with hair resting on the mat", () => {
  for (const movement of ["crunch", "bridge"] as const) {
    for (const phase of phases) {
      const pose = poseFor(movement, phase);
      expect(pose.front).toBe(false);
      expect(pose.headMirror).toBe(true);
      expect(pose.headAngle).toBe(-90);
    }
  }
});

test("curls use sagittal side-profile flexion and rows brace without hyperextending the support elbow", () => {
  for (const movement of ["curl", "self-resisted-curl"] as const) {
    const start = poseFor(movement, 0);
    const mid = poseFor(movement, 1);
    expect(start.front).toBe(false);
    expect(mid.arms[1][2][0]).toBeLessThan(mid.arms[1][1][0] - 20); // forearm curls forward in sagittal plane
  }
  const [shoulder, elbow, hand] = poseFor("row", 0).arms[0];
  const midpointY = (shoulder[1] + hand[1]) / 2;
  expect(elbow[1]).toBeGreaterThan(midpointY); // slight natural inward flexion, not hyperextended upward
});

test("real-time exercise durations and asymmetric tempo curves match controlled training speeds", () => {
  expect(movementDurations.march).toBeGreaterThanOrEqual(1);
  expect(movementDurations.march).toBeLessThanOrEqual(1.3);
  expect(movementDurations.circles).toBeGreaterThanOrEqual(1.3);
  expect(movementDurations.circles).toBeLessThanOrEqual(1.8);
  expect(movementDurations.plank).toBe(0);
  expect(movementDurations.rest).toBe(0);

  for (const movement of [
    "squat",
    "pushup",
    "pike-pushup",
    "lunge",
    "goblet-lunge",
    "press",
    "crunch",
    "row",
    "prone-w",
    "bridge",
    "curl",
    "self-resisted-curl",
  ] as const) {
    expect(movementDurations[movement]).toBeGreaterThanOrEqual(2.6);
    expect(movementDurations[movement]).toBeLessThanOrEqual(4);
  }

  // Concentric-first exercises reach peak earlier than halfway and lower more slowly than they lift.
  expect(motionPhaseFor("curl", 0.35)).toBe(2);
  expect(motionPhaseFor("crunch", 0.38)).toBe(2);
  // Eccentric-first exercises lower slowly past halfway and press back up faster.
  expect(motionPhaseFor("pushup", 0.58)).toBe(2);
  expect(motionPhaseFor("pushup", 0.3)).toBeLessThan(1.4);
});
