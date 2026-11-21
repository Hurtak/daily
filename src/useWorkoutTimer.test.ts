import { act, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { useWorkoutTimer } from "./useWorkoutTimer";
import { buildSteps, workouts } from "./workouts";
import { audioMock } from "./test/setup";

const steps = buildSteps(workouts[0]);

test("plays exactly one beep on each of the final three seconds and a different transition tone", () => {
  const { result } = renderHook(() => useWorkoutTimer(steps));
  act(() => result.current.start());
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(result.current.remaining).toBe(3);
  expect(audioMock.tones).toEqual([560]);
  for (let second = 0; second < 3; second++)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  expect(audioMock.tones).toEqual([560, 560, 560, 880]);
  expect(result.current.step.kind).toBe("warmup");
  expect(result.current.remaining).toBe(180);
});

test("plays a distinct rep beep on each rep and auto-proceeds with a transition tone", () => {
  const { result } = renderHook(() => useWorkoutTimer(steps));
  act(() => result.current.start());
  act(() => result.current.advance()); // skip prepare -> warmup
  act(() => result.current.advance()); // skip warmup -> Reverse crunch (15 reps * 3.5s)
  audioMock.tones = [];

  expect(result.current.step.name).toBe("Reverse crunch");
  expect(result.current.currentRep).toBe(1);

  act(() => {
    vi.advanceTimersByTime(3500);
  });
  expect(result.current.currentRep).toBe(2);
  expect(audioMock.tones).toEqual([420]);

  act(() => {
    vi.advanceTimersByTime(3500);
  });
  expect(result.current.currentRep).toBe(3);
  expect(audioMock.tones).toEqual([420, 420]);

  // Finish remaining 13 reps (13 * 3.5s = 45.5s) -> auto-proceeds to Self-resisted curl with 880 Hz transition tone.
  for (let rep = 0; rep < 13; rep++) {
    act(() => {
      vi.advanceTimersByTime(3500);
    });
  }
  expect(result.current.step.name).toBe("Self-resisted curl");
  expect(result.current.currentRep).toBe(1);
  // 14 rep beeps (reps 2..15) at 420 Hz, followed by 1 transition chime at 880 Hz (no 560 Hz countdown clash).
  expect(audioMock.tones).toEqual([...Array(14).fill(420), 880]);
});

test("changing rep pace mid-set keeps the current rep without a duplicate beep and paces subsequent reps at the new speed", () => {
  const normalSteps = buildSteps(workouts[0], false, "normal");
  const fastSteps = buildSteps(workouts[0], false, "fast");
  const { result, rerender } = renderHook(({ plan }) => useWorkoutTimer(plan), {
    initialProps: { plan: normalSteps },
  });
  act(() => result.current.start());
  act(() => result.current.advance());
  act(() => result.current.advance()); // Reverse crunch: normal 3.5s, fast 2.63s
  audioMock.tones = [];

  // Advance halfway through rep 2 (3.5 + 1.75 = 5.25s) -> one rep beep for rep 2.
  act(() => {
    vi.advanceTimersByTime(5250);
  });
  expect(result.current.currentRep).toBe(2);
  expect(audioMock.tones).toEqual([420]);

  // Switch to Fast mid-rep: stays on rep 2 with no duplicate beep.
  act(() => {
    result.current.flushTick();
  });
  rerender({ plan: fastSteps });
  expect(result.current.currentRep).toBe(2);
  expect(audioMock.tones).toEqual([420]);

  // Half of a fast rep (2.63 / 2 = 1.315s) later -> rep 3 fires its single 420 Hz beep.
  act(() => {
    vi.advanceTimersByTime(1400);
  });
  expect(result.current.currentRep).toBe(3);
  expect(audioMock.tones).toEqual([420, 420]);
});

test("mute suppresses cues and unmute does not repeat a cue", () => {
  const { result } = renderHook(() => useWorkoutTimer(steps));
  act(() => result.current.start());
  act(() => result.current.toggleSound());
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(audioMock.tones).toEqual([]);
  act(() => result.current.toggleSound());
  expect(audioMock.tones).toEqual([]);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(audioMock.tones).toEqual([560]);
});

test("pause excludes time, resume continues, and reset returns to an idle timer", () => {
  const { result } = renderHook(() => useWorkoutTimer(steps));
  act(() => result.current.start());
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  act(() => result.current.pause());
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(result.current.remaining).toBe(4);
  act(() => result.current.start());
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(result.current.state.totalElapsed).toBeCloseTo(2);
  act(() => result.current.reset());
  expect(result.current.state.status).toBe("ready");
  expect(vi.getTimerCount()).toBe(0);
});

test("audio failures do not prevent the timer from running", async () => {
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        throw new Error("Not supported");
      }
    },
  );
  const { result } = renderHook(() => useWorkoutTimer(steps));
  act(() => result.current.start());
  expect(result.current.audioUnavailable).toBe(true);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(result.current.remaining).toBe(4);
});

test("a rejected audio resume is reported and can recover on the next start", async () => {
  audioMock.resume.mockRejectedValueOnce(new Error("Blocked"));
  const { result } = renderHook(() => useWorkoutTimer(steps));
  await act(async () => result.current.start());
  expect(result.current.audioUnavailable).toBe(true);
  act(() => result.current.pause());
  await act(async () => result.current.start());
  expect(result.current.audioUnavailable).toBe(false);
});

test("releases the screen wake lock when paused", async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const request = vi.fn().mockResolvedValue({ release, released: false });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  const { result } = renderHook(() => useWorkoutTimer(steps));
  await act(async () => result.current.start());
  expect(request).toHaveBeenCalledWith("screen");
  act(() => result.current.pause());
  expect(release).toHaveBeenCalledOnce();
  Reflect.deleteProperty(navigator, "wakeLock");
});

test("unmount clears the ticking interval and closes audio", () => {
  const { result, unmount } = renderHook(() => useWorkoutTimer(steps));
  act(() => result.current.start());
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(audioMock.close).toHaveBeenCalledOnce();
});

test("denied wake-lock access leaves the timer usable", async () => {
  const request = vi.fn().mockRejectedValue(new Error("Denied"));
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  const { result, unmount } = renderHook(() => useWorkoutTimer(steps));
  await act(async () => result.current.start());
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(result.current.remaining).toBe(4);
  unmount();
  Reflect.deleteProperty(navigator, "wakeLock");
});

test("a wake lock acquired after pausing is immediately released", async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  let resolveLock!: (lock: { release: typeof release; released: boolean }) => void;
  const request = vi.fn(
    () =>
      new Promise<{ release: typeof release; released: boolean }>((resolve) => {
        resolveLock = resolve;
      }),
  );
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  const { result } = renderHook(() => useWorkoutTimer(steps));
  act(() => result.current.start());
  act(() => result.current.pause());
  await act(async () => resolveLock({ release, released: false }));
  expect(release).toHaveBeenCalledOnce();
  Reflect.deleteProperty(navigator, "wakeLock");
});
