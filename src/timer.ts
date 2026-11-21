import type { Step } from "./workouts.ts";

export type TimerStatus = "ready" | "running" | "paused" | "complete";
export interface TimerState {
  status: TimerStatus;
  index: number;
  elapsed: number;
  totalElapsed: number;
  lastTick: number;
  stepRepSeconds?: number;
}

export const initialTimer: TimerState = {
  status: "ready",
  index: 0,
  elapsed: 0,
  totalElapsed: 0,
  lastTick: 0,
};

export function syncStepPace(state: TimerState, steps: Step[]): TimerState {
  const nextRepSeconds = state.status === "complete" ? undefined : steps[state.index]?.repSeconds;
  if (state.stepRepSeconds === nextRepSeconds) return state;
  if (!state.stepRepSeconds || !nextRepSeconds || (state.status !== "running" && state.status !== "paused")) {
    return { ...state, stepRepSeconds: nextRepSeconds };
  }
  return {
    ...state,
    elapsed: (state.elapsed / state.stepRepSeconds) * nextRepSeconds,
    stepRepSeconds: nextRepSeconds,
  };
}

// Consume elapsed wall time, including delayed browser ticks, without accumulating drift.
export function tickTimer(state: TimerState, steps: Step[], now: number): TimerState {
  if (state.status !== "running") return state;
  const synced = syncStepPace(state, steps);
  const delta = Math.max(0, (now - synced.lastTick) / 1000);
  let elapsed = synced.elapsed + delta;
  let index = synced.index;
  while (steps[index]?.seconds !== undefined && elapsed >= steps[index].seconds!) {
    elapsed -= steps[index].seconds!;
    index++;
  }
  const complete = index >= steps.length;
  return {
    status: complete ? "complete" : "running",
    index,
    elapsed: complete ? 0 : elapsed,
    totalElapsed: synced.totalElapsed + delta - (complete ? elapsed : 0),
    lastTick: now,
    stepRepSeconds: complete ? undefined : steps[index]?.repSeconds,
  };
}

export function advanceTimer(state: TimerState, steps: Step[], now: number): TimerState {
  const current = tickTimer(state, steps, now);
  if (current.status === "complete" || current.status === "ready") return current;
  // A timed step may have finished since the button was rendered.
  if (current.index !== state.index) return current;
  const index = current.index + 1;
  const complete = index >= steps.length;
  return {
    ...current,
    index,
    elapsed: 0,
    lastTick: now,
    status: complete ? "complete" : current.status,
    stepRepSeconds: complete ? undefined : steps[index]?.repSeconds,
  };
}

export function remainingSeconds(step: Step, elapsed: number): number {
  return Math.max(0, Math.ceil((step.seconds ?? 0) - elapsed));
}

export function currentRepFor(step: Step | undefined, elapsed: number): number | undefined {
  if (!step?.reps || !step.repSeconds) return undefined;
  return Math.min(step.reps, Math.max(1, Math.floor(elapsed / step.repSeconds + 1e-6) + 1));
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)
    .toString()
    .padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`;
}
