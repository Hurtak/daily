import { useCallback, useEffect, useRef, useState } from "react";
import { loadSoundEnabled, saveSoundEnabled } from "./storage";
import { advanceTimer, currentRepFor, initialTimer, remainingSeconds, syncStepPace, tickTimer } from "./timer";
import type { TimerState } from "./timer";
import type { Step } from "./workouts";

export type CueTone = "countdown" | "transition" | "rep";

const TONE_SPEC: Record<
  CueTone,
  { type: OscillatorType; frequency: number; peakGain: number; attack: number; decay: number; stop: number }
> = {
  countdown: { type: "sine", frequency: 560, peakGain: 0.14, attack: 0.015, decay: 0.13, stop: 0.18 },
  transition: { type: "sine", frequency: 880, peakGain: 0.14, attack: 0.015, decay: 0.38, stop: 0.4 },
  rep: { type: "triangle", frequency: 420, peakGain: 0.11, attack: 0.008, decay: 0.08, stop: 0.11 },
};

export function useWorkoutTimer(steps: Step[]) {
  const [state, setState] = useState<TimerState>(initialTimer);
  const [sound, setSound] = useState<boolean>(loadSoundEnabled);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const lastCue = useRef("");

  const enableAudio = useCallback(() => {
    try {
      if (!audio.current || audio.current.state === "closed") audio.current = new AudioContext();
      void audio.current
        .resume()
        .then(() => setAudioUnavailable(false))
        .catch(() => setAudioUnavailable(true));
    } catch {
      setAudioUnavailable(true);
    }
  }, []);

  const beep = useCallback(
    (tone: CueTone) => {
      const context = audio.current;
      if (!sound || !context || context.state !== "running") return;
      const spec = TONE_SPEC[tone];
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.type = spec.type;
      oscillator.frequency.value = spec.frequency;
      const start = context.currentTime;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(spec.peakGain, start + spec.attack);
      gain.gain.exponentialRampToValueAtTime(0.001, start + spec.decay);
      oscillator.start(start);
      oscillator.stop(start + spec.stop);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    },
    [sound],
  );

  useEffect(() => {
    if (state.status !== "running") return;
    const id = window.setInterval(() => setState((previous) => tickTimer(previous, steps, performance.now())), 100);
    return () => window.clearInterval(id);
  }, [state.status, steps]);

  const current = syncStepPace(state, steps);
  const step = steps[Math.min(current.index, steps.length - 1)];
  const remaining = step?.seconds === undefined ? undefined : remainingSeconds(step, current.elapsed);
  const currentRep = currentRepFor(step, current.elapsed);
  useEffect(() => {
    if (current.status !== "running" && current.status !== "complete") return;
    const isRepStep = currentRep !== undefined;
    const cue =
      current.status === "complete"
        ? "complete"
        : isRepStep
          ? `${current.index}:rep:${currentRep}`
          : `${current.index}:${remaining !== undefined && remaining <= 3 ? remaining : "start"}`;
    if (cue === lastCue.current) return;
    const previousIndex = lastCue.current.split(":")[0];
    lastCue.current = cue;
    if (current.status === "complete" || (previousIndex !== String(current.index) && current.index > 0)) {
      beep("transition");
    } else if (isRepStep) {
      if (currentRep > 1) beep("rep");
    } else if (remaining !== undefined && remaining <= 3 && remaining > 0) {
      beep("countdown");
    }
  }, [current.index, current.status, remaining, currentRep, beep]);

  const pause = useCallback(
    () =>
      setState((previous) => {
        if (previous.status !== "running") return previous;
        const ticked = tickTimer(previous, steps, performance.now());
        return {
          ...ticked,
          status: ticked.status === "complete" ? "complete" : "paused",
        };
      }),
    [steps],
  );

  const flushTick = useCallback(() => {
    setState((previous) => (previous.status === "running" ? tickTimer(previous, steps, performance.now()) : previous));
  }, [steps]);

  function start() {
    enableAudio();
    setState((previous) => ({
      ...syncStepPace(previous, steps),
      status: "running",
      lastTick: performance.now(),
    }));
  }

  // The screen stays awake while training when the browser supports it.
  useEffect(() => {
    if (state.status !== "running" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    async function acquire() {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (disposed) await next.release();
        else lock = next;
      } catch {
        /* A wake lock is optional; the timer still works. */
      }
    }
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [state.status]);

  useEffect(
    () => () => {
      const context = audio.current;
      audio.current = null;
      void context?.close();
    },
    [],
  );

  return {
    state: current,
    step,
    remaining,
    currentRep,
    sound,
    audioUnavailable,
    start,
    pause,
    flushTick,
    advance: () => setState((previous) => advanceTimer(previous, steps, performance.now())),
    reset: () => {
      lastCue.current = "";
      setState(initialTimer);
    },
    toggleSound: () => {
      if (!sound) enableAudio();
      setSound((previous) => {
        const next = !previous;
        saveSoundEnabled(next);
        return next;
      });
    },
  };
}
