import type { RepPace } from "./storage";
import type { Movement } from "./workouts";

export type Point = readonly [number, number];
export type Limb = readonly [Point, Point, Point];
export type Phase = 0 | 1 | 2;
export const anatomy = {
  upperArm: 29,
  forearm: 24,
  thigh: 36,
  shin: 32,
  upperBack: 28,
  lowerBack: 16,
  neckToHead: 15,
  headRadius: 9,
  foot: 10,
};
export const ground = 190;

interface Torso {
  spine: readonly [Point, Point, Point]; // shoulder centre, waist, pelvis
  shoulders: readonly [Point, Point];
  hips: readonly [Point, Point];
  head: Point;
  headAngle: number;
  headMirror?: boolean;
  front: boolean;
}
export interface Pose extends Torso {
  arms: readonly [Limb, Limb]; // far, near (left, right in front/overhead views)
  legs: readonly [Limb, Limb];
  toes: readonly [Point, Point];
  bell?: { grip: Point; rotation: number };
  support?: "bench" | "mat" | "overhead-mat";
}

// Real-time duration (seconds) for one full rep or stride cycle at proper controlled exercise tempo.
export const movementDurations: Record<Movement, number> = {
  march: 1.1,
  circles: 1.5,
  squat: 2.8,
  pushup: 3.2,
  "pike-pushup": 3.6,
  lunge: 3.2,
  "goblet-lunge": 3.6,
  press: 3.6,
  crunch: 3.5,
  row: 3.2,
  "prone-w": 3.4,
  bridge: 3.4,
  curl: 3.6,
  "self-resisted-curl": 3.8,
  plank: 0,
  rest: 0,
};

export const repPaceMultipliers: Record<RepPace, number> = {
  slow: 1.3,
  normal: 1,
  fast: 0.75,
};

export function repDurationFor(movement: Movement, pace: RepPace = "normal"): number {
  const base = movementDurations[movement];
  if (base <= 0) return 0;
  return Math.round(base * repPaceMultipliers[pace] * 100) / 100;
}

interface TempoCurve {
  rise: number; // fraction of cycle moving phase 0 -> 2
  holdPeak: number; // fraction holding phase 2
  fall: number; // fraction returning phase 2 -> 0
}

// Asymmetric real-time cadences: controlled lowering (eccentric) and crisp lift (concentric) with brief control pauses.
const tempoCurves: Partial<Record<Exclude<Movement, "rest" | "plank" | "march" | "circles">, TempoCurve>> = {
  squat: { rise: 0.54, holdPeak: 0.06, fall: 0.34 },
  pushup: { rise: 0.56, holdPeak: 0.06, fall: 0.31 },
  "pike-pushup": { rise: 0.55, holdPeak: 0.06, fall: 0.31 },
  lunge: { rise: 0.53, holdPeak: 0.06, fall: 0.34 },
  "goblet-lunge": { rise: 0.53, holdPeak: 0.06, fall: 0.33 },
  crunch: { rise: 0.31, holdPeak: 0.12, fall: 0.51 },
  bridge: { rise: 0.29, holdPeak: 0.15, fall: 0.5 },
  "prone-w": { rise: 0.29, holdPeak: 0.18, fall: 0.47 },
  row: { rise: 0.28, holdPeak: 0.1, fall: 0.56 },
  curl: { rise: 0.3, holdPeak: 0.09, fall: 0.55 },
  "self-resisted-curl": { rise: 0.34, holdPeak: 0.08, fall: 0.52 },
  press: { rise: 0.28, holdPeak: 0.09, fall: 0.55 },
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;
export const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const heading = (a: Point, b: Point) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
export const angleBetween = (from: number, to: number) => ((to - from + 540) % 360) - 180;
const offset = (p: Point, x: number, y: number): Point => [p[0] + x, p[1] + y];
const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

function valueAt(values: readonly number[], phase: number): number {
  const index = Math.min(1, Math.floor(phase));
  return values[index] + (values[index + 1] - values[index]) * (phase - index);
}
const pointAt = (values: readonly Point[], phase: number): Point => [
  valueAt(
    values.map(([x]) => x),
    phase,
  ),
  valueAt(
    values.map(([, y]) => y),
    phase,
  ),
];
function along(p: Point, length: number, angle: number): Point {
  return offset(p, Math.cos(radians(angle)) * length, Math.sin(radians(angle)) * length);
}
function chain(start: Point, a: number, angleA: number, b: number, angleB: number): Limb {
  const joint = along(start, a, angleA);
  return [start, joint, along(joint, b, angleB)];
}
const arm = (start: Point, upper: number, lower: number) =>
  chain(start, anatomy.upperArm, upper, anatomy.forearm, lower);
const leg = (start: Point, angle: number) => chain(start, anatomy.thigh, angle, anatomy.shin, angle);

// Two fixed-length segments meeting an anchored hand or foot.
// Pose tests verify that every target remains within the limb's reach.
function bend(start: Point, end: Point, a: number, b: number, sign: number): Limb {
  const d = distance(start, end);
  const x = (a * a - b * b + d * d) / (2 * d);
  const y = Math.sqrt(Math.max(0, a * a - x * x)) * sign;
  const ux = (end[0] - start[0]) / d;
  const uy = (end[1] - start[1]) / d;
  return [start, offset(start, ux * x - uy * y, uy * x + ux * y), end];
}
const bendArm = (start: Point, end: Point, sign = -1) => bend(start, end, anatomy.upperArm, anatomy.forearm, sign);
const bendLeg = (start: Point, end: Point, sign = 1) => bend(start, end, anatomy.thigh, anatomy.shin, sign);

function torso(hip: Point, heading = -90, front = false): Torso {
  const waist = along(hip, anatomy.lowerBack, heading);
  const shoulder = along(waist, anatomy.upperBack, heading);
  const width = heading + 90;
  return {
    spine: [shoulder, waist, hip],
    shoulders: [along(shoulder, front ? -13 : -1, width), along(shoulder, front ? 13 : 1, width)],
    hips: [along(hip, front ? -8 : -1, width), along(hip, front ? 8 : 1, width)],
    head: along(shoulder, anatomy.neckToHead, heading),
    headAngle: heading + 90,
    front,
  };
}
const flatToe = (ankle: Point, direction = -1): Point => offset(ankle, Math.sqrt(anatomy.foot ** 2 - 1) * direction, 1);
function finish(
  body: Torso,
  arms: Pose["arms"],
  legs: Pose["legs"],
  options: Partial<Pick<Pose, "bell" | "support" | "toes">> = {},
): Pose {
  return {
    ...body,
    arms,
    legs,
    toes: [flatToe(legs[0][2], -1), flatToe(legs[1][2], body.front ? 1 : -1)],
    ...options,
  };
}
function standing(front = true) {
  const body = torso([130, 118.5], -90, front);
  const feet: readonly [Point, Point] = front
    ? [
        [116, 186],
        [144, 186],
      ]
    : [
        [128, 186],
        [136, 186],
      ];
  const legs: Pose["legs"] = [bendLeg(body.hips[0], feet[0]), bendLeg(body.hips[1], feet[1])];
  return { body, legs };
}

// Fractional phases solve the same fixed-length skeleton between the three key poses.
export function poseFor(movement: Exclude<Movement, "rest">, phase: number): Pose {
  switch (movement) {
    case "squat": {
      const hips: Point[] = [
        [140, 118.5],
        [149, 137],
        [160, 153],
      ];
      const body = torso(pointAt(hips, phase), valueAt([-90, -105, -120], phase));
      // Arms start naturally at sides while standing and counterbalance forward as hips descend.
      const upperArm = valueAt([102, 148, 192], phase);
      const forearm = valueAt([114, 154, 188], phase);
      return finish(
        body,
        [arm(body.shoulders[0], upperArm, forearm), arm(body.shoulders[1], upperArm, forearm)],
        [bendLeg(body.hips[0], [132, 186]), bendLeg(body.hips[1], [140, 186])],
      );
    }
    case "march": {
      const { body, legs } = standing(false);
      const lifted = (resting: Limb, amount: number) => {
        const upper = heading(resting[0], resting[1]);
        const lower = heading(resting[1], resting[2]);
        return chain(
          resting[0],
          anatomy.thigh,
          upper + angleBetween(upper, -150) * amount,
          anatomy.shin,
          lower + angleBetween(lower, 90) * amount,
        );
      };
      const marching: Pose["legs"] = [lifted(legs[0], Math.max(0, 1 - phase)), lifted(legs[1], Math.max(0, phase - 1))];
      const farArm = valueAt([55, 90, 125], phase);
      const nearArm = valueAt([125, 90, 55], phase);
      return finish(
        body,
        [arm(body.shoulders[0], farArm, farArm + 90), arm(body.shoulders[1], nearArm, nearArm + 90)],
        marching,
      );
    }
    case "pushup": {
      const headingAngle = valueAt([203, 198, 193], phase);
      const toe: Point = [204, 187];
      const ankle = along(toe, anatomy.foot, -60);
      const hip = along(ankle, anatomy.thigh + anatomy.shin, headingAngle);
      const body: Torso = { ...torso(hip, headingAngle), hips: [hip, hip] };
      // Both legs remain straight and parallel to the neutral trunk, hands stacked beneath shoulders.
      const legs: Pose["legs"] = [leg(body.hips[0], headingAngle - 180), leg(body.hips[1], headingAngle - 180)];
      return finish(body, [bendArm(body.shoulders[0], [111, 186]), bendArm(body.shoulders[1], [105, 186])], legs, {
        support: "mat",
        toes: [toe, toe],
      });
    }
    case "pike-pushup": {
      const toe: Point = [200, 187];
      const ankle = along(toe, anatomy.foot, -60);
      const legHeading = valueAt([-118, -125, -132], phase);
      const hip = along(ankle, anatomy.thigh + anatomy.shin, legHeading);
      const body = torso(hip, valueAt([159, 152, 145], phase));
      const legs: Pose["legs"] = [leg(hip, legHeading + 180), leg(hip, legHeading + 180)];
      return finish(body, [bendArm(body.shoulders[0], [136, 186]), bendArm(body.shoulders[1], [129, 186])], legs, {
        support: "mat",
        toes: [toe, toe],
      });
    }
    case "lunge":
    case "goblet-lunge": {
      const hips: Point[] = [
        [130, 118.5],
        [145, 132],
        [160, 152],
      ];
      const body = torso(pointAt(hips, phase), valueAt([-90, -94, -97], phase));
      const rearToe = pointAt([flatToe([136, 186]), [170, 187], [195, 187]], phase);
      const footAngle = valueAt([heading([136, 186], flatToe([136, 186])), 120, 120], phase);
      const rearAnkle = along(rearToe, anatomy.foot, footAngle + 180);
      const grip = offset(body.spine[0], -14, 10);
      const loaded = movement === "goblet-lunge";
      const arms: Pose["arms"] = loaded
        ? [bendArm(body.shoulders[0], offset(grip, -4, 0)), bendArm(body.shoulders[1], offset(grip, 4, 0))]
        : [
            arm(body.shoulders[0], valueAt([94, 100, 106], phase), valueAt([102, 124, 140], phase)),
            arm(body.shoulders[1], valueAt([88, 94, 100], phase), valueAt([96, 118, 134], phase)),
          ];
      return finish(body, arms, [bendLeg(body.hips[0], rearAnkle), bendLeg(body.hips[1], [130, 186])], {
        bell: loaded ? { grip, rotation: 0 } : undefined,
        toes: [rearToe, flatToe([130, 186])],
      });
    }
    case "press": {
      const { body, legs } = standing(true);
      const arms: Pose["arms"] = [
        arm(body.shoulders[0], 96, 86),
        arm(body.shoulders[1], valueAt([80, 0, -90], phase), -90),
      ];
      // Normal rack/press: the bell rests behind the wrist and stays stacked smoothly to lockout.
      return finish(body, arms, legs, {
        bell: { grip: arms[1][2], rotation: valueAt([-45, -35, -22], phase) },
      });
    }
    case "curl": {
      // Side profile shows true sagittal elbow flexion with fixed upper arm by the ribs.
      const { body, legs } = standing(false);
      const arms: Pose["arms"] = [
        arm(body.shoulders[0], 94, 102),
        arm(body.shoulders[1], 88, valueAt([90, 175, 244], phase)),
      ];
      return finish(body, arms, legs, {
        bell: { grip: arms[1][2], rotation: 0 },
      });
    }
    case "self-resisted-curl": {
      // Side profile shows the working arm curling forward while the free hand resists against the forearm.
      const { body, legs } = standing(false);
      const forearm = valueAt([108, 175, 240], phase);
      const workingArm = arm(body.shoulders[1], 100, forearm);
      const contact = along(workingArm[1], anatomy.forearm * (2 / 3), forearm);
      const resistingArm = bendArm(body.shoulders[0], contact, -1);
      return finish(body, [resistingArm, workingArm], legs);
    }
    case "row": {
      const body = torso([158, 122], -155);
      const upper = valueAt([90, 45, -5], phase);
      const arms: Pose["arms"] = [
        // Sign -1 keeps the bracing elbow naturally slightly flexed inward rather than hyperextended.
        bendArm(body.shoulders[0], [82, 141], -1),
        arm(body.shoulders[1], upper, valueAt([90, 102, 116], phase)),
      ];
      return finish(body, arms, [bendLeg(body.hips[0], [143, 186]), bendLeg(body.hips[1], [174, 186])], {
        bell: { grip: arms[1][2], rotation: 0 },
        support: "bench",
      });
    }
    case "prone-w": {
      const body = torso([130, 108], -90, true);
      const upperArm = valueAt([54, 38, 22], phase);
      const forearm = valueAt([52, 70, 86], phase);
      const legs: Pose["legs"] = [leg(body.hips[0], 94), leg(body.hips[1], 86)];
      return finish(
        body,
        [arm(body.shoulders[0], 180 - upperArm, forearm - 180), arm(body.shoulders[1], upperArm, -forearm)],
        legs,
        {
          support: "overhead-mat",
          toes: [along(legs[0][2], anatomy.foot, 94), along(legs[1][2], anatomy.foot, 86)],
        },
      );
    }
    case "crunch": {
      const shoulder: Point = [63, 181];
      const waist = along(shoulder, anatomy.upperBack, 0);
      const hip = along(waist, anatomy.lowerBack, valueAt([0, -28, -55], phase));
      const body: Torso = {
        spine: [shoulder, waist, hip],
        shoulders: [
          [63, 185],
          [63, 186],
        ],
        hips: [offset(hip, 0, -1), offset(hip, 0, 1)],
        head: [48, 181],
        // Mirrored profile rotated -90 deg places hair on crown/occiput on the mat and face looking upward.
        headAngle: -90,
        headMirror: true,
        front: false,
      };
      const thigh = valueAt([-90, -110, -125], phase);
      const legs: Pose["legs"] = [
        chain(body.hips[0], anatomy.thigh, thigh, anatomy.shin, thigh + 90),
        chain(body.hips[1], anatomy.thigh, thigh, anatomy.shin, thigh + 90),
      ];
      return finish(body, [arm(body.shoulders[0], 0, 0), arm(body.shoulders[1], 0, 0)], legs, {
        support: "mat",
        toes: [along(legs[0][2], anatomy.foot, thigh), along(legs[1][2], anatomy.foot, thigh)],
      });
    }
    case "bridge": {
      const shoulder: Point = [63, 181];
      // At full hip extension, shoulder, pelvis and working knee form one line;
      // the working shin is vertical and its foot stays planted throughout.
      const topAngle = -Math.asin(
        (anatomy.shin - (186 - shoulder[1])) / (anatomy.upperBack + anatomy.lowerBack + anatomy.thigh),
      );
      const headingAngle = ((topAngle * phase) / 2 / Math.PI) * 180;
      const waist = along(shoulder, anatomy.upperBack, headingAngle);
      const hip = along(waist, anatomy.lowerBack, headingAngle);
      const workingAnkle: Point = [
        shoulder[0] + (anatomy.upperBack + anatomy.lowerBack + anatomy.thigh) * Math.cos(topAngle),
        186,
      ];
      const body: Torso = {
        spine: [shoulder, waist, hip],
        shoulders: [
          [63, 185],
          [63, 186],
        ],
        hips: [hip, hip],
        head: [48, 181],
        headAngle: -90,
        headMirror: true,
        front: false,
      };
      const legs: Pose["legs"] = [chain(hip, anatomy.thigh, -105, anatomy.shin, -15), bendLeg(hip, workingAnkle, -1)];
      return finish(body, [arm(body.shoulders[0], 0, 0), arm(body.shoulders[1], 0, 0)], legs, {
        support: "mat",
        toes: [along(legs[0][2], anatomy.foot, -105), flatToe(workingAnkle, 1)],
      });
    }
    case "plank": {
      // Solve the body's incline so the upper arm reaches the mat vertically.
      const legLength = anatomy.thigh + anatomy.shin;
      const bodyLength = legLength + anatomy.upperBack + anatomy.lowerBack;
      const angle =
        ((Math.atan2(5, bodyLength) + Math.asin(anatomy.upperArm / Math.hypot(bodyLength, 5))) * 180) / Math.PI;
      const hip: Point = [145, 186 - legLength * Math.sin(radians(angle)) - 8 * Math.cos(radians(angle))];
      // Front view shows stacked shoulders and hips rather than a high plank.
      const body = torso(hip, angle + 180, true);
      const topLegAngle = (Math.asin((180 - body.hips[1][1]) / legLength) * 180) / Math.PI;
      const legs: Pose["legs"] = [leg(body.hips[0], angle), leg(body.hips[1], topLegAngle)];
      const supportShoulder = body.shoulders[0];
      const elbow = offset(supportShoulder, 0, anatomy.upperArm);
      const supporting: Limb = [supportShoulder, elbow, offset(elbow, -anatomy.forearm, 0)];
      const free = bendArm(body.shoulders[1], body.hips[1], -1);
      return finish(body, [supporting, free], legs, {
        support: "mat",
        toes: [along(legs[0][2], anatomy.foot, angle - 90), along(legs[1][2], anatomy.foot, topLegAngle - 90)],
      });
    }
    case "circles": {
      const { body, legs } = standing(false);
      const angle = -30 - phase * 120;
      return finish(body, [arm(body.shoulders[0], angle, angle), arm(body.shoulders[1], angle, angle)], legs);
    }
  }
}

export function motionPhaseFor(movement: Exclude<Movement, "rest">, progress: number): number {
  if (movement === "plank") return 0;
  if (movement === "circles") return progress * 3;
  if (movement === "march") return 1 - Math.cos(progress * Math.PI * 2);
  const curve = tempoCurves[movement];
  if (!curve) return 1 - Math.cos(progress * Math.PI * 2);
  const { rise, holdPeak, fall } = curve;
  if (progress < rise) return 2 * ease(progress / rise);
  if (progress < rise + holdPeak) return 2;
  if (progress < rise + holdPeak + fall) return 2 * (1 - ease((progress - rise - holdPeak) / fall));
  return 0;
}

export function motionPosesFor(movement: Exclude<Movement, "rest">): Pose[] {
  if (movement === "plank") return [poseFor(movement, 0)];
  // Sample the rig once; CSS interpolates joint rotations at the display's refresh rate.
  const samples = 60;
  const poses = Array.from({ length: samples }, (_, index) => {
    const progress = index / samples;
    return poseFor(movement, motionPhaseFor(movement, progress));
  });
  return [...poses, poses[0]];
}

export const movementDescriptions: Record<Movement, string> = {
  march: "Stand tall and march in place. Alternate lifting each knee while pumping the opposite arm.",
  squat: "Sit back and down with both feet planted. Keep a neutral spine as the knees and hips bend together.",
  circles:
    "Keep the elbows straight and circle the arms from the shoulders. The curved arrow indicates the circular path.",
  pushup: "Keep the head, trunk, and legs in one line. Bend the elbows while the hands and toes stay planted.",
  "pike-pushup":
    "Keep the hips high in an inverted V. Lower the head toward the floor and press back up with hands and feet planted.",
  lunge:
    "Keep the working foot forward and planted. Step the other foot back, lower the rear knee, then return to standing.",
  "goblet-lunge": "Hold the kettlebell at your chest as you step back, with the working foot forward and planted.",
  press: "Press one kettlebell from the rack to a straight arm overhead. Keep the wrist stacked and the torso still.",
  crunch:
    "Keep the head and shoulders on the mat and the knees bent. Curl the pelvis toward the ribs, then lower with control.",
  row: "Brace the free hand on a sturdy support. Keep the trunk still while pulling the kettlebell toward the hip.",
  "prone-w":
    "Shown from above. Lie face down with elbows bent in a W. Squeeze the shoulder blades together and lift the arms slightly.",
  bridge:
    "Lie on your back with the working foot planted and the other leg lifted. Raise and lower the pelvis with a neutral back while the head, shoulders, and working foot stay on the mat.",
  curl: "Keep the upper arm by the ribs and the torso still. Bend only the elbow to raise and lower the kettlebell.",
  "self-resisted-curl":
    "Curl palm up while the free hand presses against the working forearm through the lift and lower.",
  plank:
    "Hold still on the forearm with the supporting elbow below the shoulder. Keep the hips lifted and the body aligned.",
  rest: "Rest and let your breathing settle.",
};
