import { expect, test } from "vite-plus/test";
import { buildSteps, warmupAt, warmupFor, workouts } from "./workouts";

test("the new plans start with bodyweight abs, biceps and shoulders on A and full body on B", () => {
  expect(workouts[0].exercises.map(({ movement, reps }) => [movement, reps])).toEqual([
    ["crunch", "10–15 reps"],
    ["self-resisted-curl", "8–12 reps"],
    ["pike-pushup", "5–10 reps"],
    ["plank", "20–30 sec"],
  ]);
  expect(workouts[1].exercises.map(({ movement, reps }) => [movement, reps])).toEqual([
    ["lunge", "8–12 reps"],
    ["prone-w", "10–15 reps"],
    ["pushup", "8–15 reps"],
    ["bridge", "10–15 reps"],
  ]);
  expect(workouts[0].exercises[3].seconds).toBe(30);
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      expect(exercise.kettlebell).toBeUndefined();
      expect(exercise.muscles.length).toBeGreaterThanOrEqual(2);
    }
  }
});

test.each(workouts)("$name finishes all three priority rounds before the two secondary rounds", (workout) => {
  const plan = buildSteps(workout);
  const rounds = plan.filter((step) => step.kind === "rest").map(({ block, round }) => [block, round]);
  expect(rounds).toEqual([
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 1],
  ]);
  const pair2 = plan.findIndex((step) => step.block === 2);
  expect(plan.slice(2, pair2).every((step) => step.block === 1)).toBe(true);
  expect(plan.slice(pair2).every((step) => step.block === 2)).toBe(true);
  expect(plan.at(-1)).toMatchObject({ kind: "exercise", round: 2, block: 2, side: "Right" });
  expect(plan.filter((step) => step.kind === "exercise")).toHaveLength(15);
});

test("kettlebell mode supplies kettlebell reps, sides, and warm-up drills across both workouts", () => {
  const workoutA = workouts[0];
  const stepsA = buildSteps(workoutA, true);
  expect(stepsA.filter((step) => step.exercise?.movement === "curl").map((step) => step.side)).toEqual([
    "Left",
    "Right",
    "Left",
    "Right",
    "Left",
    "Right",
  ]);
  expect(stepsA.filter((step) => step.exercise?.movement === "press").map((step) => step.side)).toEqual([
    "Left",
    "Right",
    "Left",
    "Right",
  ]);
  expect(
    warmupFor(workoutA, true)
      .slice(3)
      .map((step) => step.movement),
  ).toEqual(["crunch", "curl", "press", "plank"]);

  const firstRound = buildSteps(workouts[1], true).slice(2, 6);
  expect(firstRound.map((step) => [step.exercise?.movement, step.exercise?.reps, step.side])).toEqual([
    ["goblet-lunge", "8–12 reps", "Left"],
    ["goblet-lunge", "8–12 reps", "Right"],
    ["row", "10–15 reps", "Left"],
    ["row", "10–15 reps", "Right"],
  ]);
});

test.each(workouts)("$name warms up for exactly three minutes and rehearses its own exercises", (workout) => {
  const moves = warmupFor(workout);
  expect(moves.reduce((seconds, move) => seconds + move.seconds, 0)).toBe(180);
  expect(moves.map((move) => move.movement)).toEqual([
    "march",
    "squat",
    "circles",
    ...workout.exercises.map((exercise) => exercise.movement),
  ]);
  expect(warmupAt(moves, 0).movement).toBe("march");
  expect(warmupAt(moves, 44.99).movement).toBe("march");
  expect(warmupAt(moves, 45).movement).toBe("squat");
  expect(warmupAt(moves, 75).movement).toBe("circles");
  expect(warmupAt(moves, 120).movement).toBe(workout.exercises[0].movement);
  expect(warmupAt(moves, 135).movement).toBe(workout.exercises[1].movement);
  expect(warmupAt(moves, 150).movement).toBe(workout.exercises[2].movement);
  expect(warmupAt(moves, 165).movement).toBe(workout.exercises[3].movement);
  expect(warmupAt(moves, 180).movement).toBe(workout.exercises[3].movement);
});
