import { expect, test } from "vite-plus/test";
import {
  advanceTimer,
  currentRepFor,
  formatTime,
  initialTimer,
  remainingSeconds,
  syncStepPace,
  tickTimer,
} from "./timer";
import { buildSteps, workouts } from "./workouts";
import { loadRepPace, saveRepPace } from "./storage";
import type { TimerState } from "./timer";

const steps = buildSteps(workouts[0]);
const running: TimerState = {
  ...initialTimer,
  status: "running",
  lastTick: 1000,
};

test.each(workouts)("$name preserves pairs, rounds, both sides, rep pacing, and rests", (workout) => {
  const plan = buildSteps(workout);
  expect(plan[0].seconds).toBe(5);
  expect(plan[1].seconds).toBe(180);
  expect(plan.filter((step) => step.kind === "rest")).toHaveLength(4);
  expect(plan.filter((step) => step.kind === "rest").every((step) => step.seconds === 60)).toBe(true);
  for (const [index, exercise] of workout.exercises.entries()) {
    const rounds = index < 2 ? 3 : 2;
    const sets = plan.filter((step) => step.exercise === exercise);
    expect(sets).toHaveLength(rounds * (exercise.sides ? 2 : 1));
    expect(sets.every((step) => step.rounds === rounds)).toBe(true);
    if (exercise.sides) {
      expect(sets.filter((step) => step.side === "Left")).toHaveLength(rounds);
      expect(sets.filter((step) => step.side === "Right")).toHaveLength(rounds);
      for (const step of sets.filter((step) => step.side === "Left")) {
        expect(plan[plan.indexOf(step) + 1]).toMatchObject({ exercise, side: "Right", round: step.round });
      }
    }
  }
  expect(plan.at(-1)?.exercise).toBe(workout.exercises[3]);
  expect(plan.filter((step) => step.kind === "exercise" && step.reps === undefined)).toHaveLength(
    workout.id === "a" ? 4 : 0,
  );
  for (const step of plan.filter((item) => item.kind === "exercise" && item.reps !== undefined)) {
    expect(step.reps).toBeGreaterThan(0);
    expect(step.repSeconds).toBeGreaterThan(0);
    expect(step.seconds).toBeCloseTo(step.reps! * step.repSeconds!, 2);
  }
});

test("delayed ticks cross timed phases and auto-proceed through rep-paced sets", () => {
  const afterWarmup = tickTimer(running, steps, 191_000);
  expect(afterWarmup.index).toBe(2);
  expect(afterWarmup.elapsed).toBe(5);
  expect(afterWarmup.totalElapsed).toBe(190);
  expect(afterWarmup.status).toBe("running");
  expect(currentRepFor(steps[2], afterWarmup.elapsed)).toBe(2);

  // Reverse crunch is 15 reps * 3.5s = 52.5s; 48s more crosses into Self-resisted curl (Left).
  const afterCrunch = tickTimer(afterWarmup, steps, 239_000);
  expect(afterCrunch.index).toBe(3);
  expect(steps[afterCrunch.index]).toMatchObject({ name: "Self-resisted curl", side: "Left" });
  expect(afterCrunch.elapsed).toBeCloseTo(0.5, 4);
});

test("slow, normal, and fast paces scale rep duration and preserve fractional rep progress on switch", () => {
  const slowPlan = buildSteps(workouts[0], false, "slow");
  const normalPlan = buildSteps(workouts[0], false, "normal");
  const fastPlan = buildSteps(workouts[0], false, "fast");
  const slow = slowPlan[2];
  const normal = normalPlan[2];
  const fast = fastPlan[2];

  expect(slow.reps).toBe(15);
  expect(normal.reps).toBe(15);
  expect(fast.reps).toBe(15);
  expect(slow.repSeconds!).toBeGreaterThan(normal.repSeconds!);
  expect(normal.repSeconds!).toBeGreaterThan(fast.repSeconds!);

  const midRepFour: TimerState = {
    ...running,
    index: 2,
    elapsed: normal.repSeconds! * 3.5,
    stepRepSeconds: normal.repSeconds,
  };
  expect(currentRepFor(normal, midRepFour.elapsed)).toBe(4);
  const rescaled = syncStepPace(midRepFour, fastPlan);
  expect(currentRepFor(fast, rescaled.elapsed)).toBe(4);
  expect(rescaled.elapsed / fast.repSeconds!).toBeCloseTo(3.5, 6);
  expect(rescaled.stepRepSeconds).toBe(fast.repSeconds);

  expect(loadRepPace()).toBe("normal");
  saveRepPace("fast");
  expect(loadRepPace()).toBe("fast");
  window.localStorage.setItem("daily.repPace.v1", JSON.stringify("invalid"));
  expect(loadRepPace()).toBe("normal");
});

test("pause and resume exclude the paused duration", () => {
  const current = tickTimer(running, steps, 3000);
  const paused: TimerState = { ...current, status: "paused" };
  expect(tickTimer(paused, steps, 100_000)).toBe(paused);
  const resumed = tickTimer({ ...paused, status: "running", lastTick: 100_000 }, steps, 101_000);
  expect(resumed.elapsed).toBe(3);
  expect(resumed.totalElapsed).toBe(3);
});

test("completing a rep set resets its clock and preserves session time", () => {
  const inSet = { ...running, index: 2, elapsed: 20, totalElapsed: 205 };
  const next = advanceTimer(inSet, steps, 2000);
  expect(next.index).toBe(3);
  expect(steps[next.index]).toMatchObject({ name: "Self-resisted curl", side: "Left" });
  expect(next.elapsed).toBe(0);
  expect(next.totalElapsed).toBe(206);
});

test("side plank changes sides automatically and rests before the next pike push-up round", () => {
  const plan = buildSteps(workouts[0]);
  const state = { ...running, index: plan.findIndex((step) => step.exercise?.movement === "plank") };
  const right = tickTimer(state, plan, 32_000);
  expect(plan[right.index].side).toBe("Right");
  expect(right.elapsed).toBe(1);
  const rest = tickTimer(right, plan, 63_000);
  expect(plan[rest.index].kind).toBe("rest");
  expect(rest.status).toBe("running");
  expect(rest.elapsed).toBe(2);
  const next = tickTimer(rest, plan, 121_000);
  expect(plan[next.index]).toMatchObject({ name: "Pike push-up", round: 2 });
});

test("manual completion works while paused and finishes without another rest", () => {
  const last: TimerState = {
    ...running,
    status: "paused",
    index: steps.length - 1,
  };
  expect(advanceTimer(last, steps, 10_000).status).toBe("complete");
  expect(advanceTimer(initialTimer, steps, 10_000)).toBe(initialTimer);
});

test("countdowns round up so the final second stays visible", () => {
  expect(remainingSeconds(steps[0], 2.01)).toBe(3);
  expect(remainingSeconds(steps[0], 4.99)).toBe(1);
  expect(remainingSeconds(steps[0], 6)).toBe(0);
  expect(formatTime(180)).toBe("03:00");
  expect(formatTime(35)).toBe("00:35");
});

test("a skip at an automatic transition advances only once", () => {
  const atBoundary = { ...running, elapsed: 4.95 };
  const next = advanceTimer(atBoundary, steps, 1100);
  expect(next.index).toBe(1);
  expect(next.elapsed).toBeCloseTo(0.05);
});

test("completed timers stay completed and elapsed time cannot go backward", () => {
  const done: TimerState = {
    ...running,
    status: "complete",
    index: steps.length,
  };
  expect(tickTimer(done, steps, 9000)).toBe(done);
  expect(advanceTimer(done, steps, 9000)).toBe(done);
  expect(tickTimer(running, steps, 500).elapsed).toBe(0);
  expect(formatTime(-1)).toBe("00:00");
  expect(formatTime(60.9)).toBe("01:00");
});
