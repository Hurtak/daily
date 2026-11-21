import { useEffect, useMemo, useRef, useState } from "react";
import ExerciseGuide from "./ExerciseGuide";
import MovementDiagram from "./MovementDiagram";
import Icon from "./Icon";
import InfoDialog from "./InfoDialog";
import {
  buildSteps,
  exerciseFor,
  exerciseReps,
  pairRounds,
  restSeconds,
  warmupAt,
  warmupFor,
  workoutMinutes,
} from "./workouts";
import type { Workout, WorkoutExercise } from "./workouts";
import { loadKettlebellEnabled, loadRepPace, saveKettlebellEnabled, saveRepPace } from "./storage";
import type { RepPace } from "./storage";
import { formatTime } from "./timer";
import { useWorkoutTimer } from "./useWorkoutTimer";

interface Props {
  workout: Workout;
  visible: boolean;
  onBack: () => void;
  onFocusChange: (focused: boolean) => void;
  onComplete?: () => void;
  useKettlebell?: boolean;
  onKettlebellChange?: (enabled: boolean) => void;
  repPace?: RepPace;
  onRepPaceChange?: (pace: RepPace) => void;
}
type Info = "plan" | "warmup" | "form" | "restart" | WorkoutExercise;

const REP_PACES: readonly { id: RepPace; label: string }[] = [
  { id: "slow", label: "Slow" },
  { id: "normal", label: "Normal" },
  { id: "fast", label: "Fast" },
];

export default function WorkoutPlayer({
  workout,
  visible,
  onBack,
  onFocusChange,
  onComplete,
  useKettlebell: controlledKettlebell,
  onKettlebellChange,
  repPace: controlledRepPace,
  onRepPaceChange,
}: Props) {
  const [localKettlebell, setLocalKettlebell] = useState(loadKettlebellEnabled);
  const useKettlebell = controlledKettlebell ?? localKettlebell;
  const [sessionKettlebell, setSessionKettlebell] = useState<boolean | null>(null);
  const activeKettlebell = sessionKettlebell ?? useKettlebell;
  const [localRepPace, setLocalRepPace] = useState<RepPace>(loadRepPace);
  const repPace = controlledRepPace ?? localRepPace;
  const [paceOffset, setPaceOffset] = useState<{ stepIndex: number; pace: RepPace; offset: number } | null>(null);
  const steps = useMemo(() => buildSteps(workout, activeKettlebell, repPace), [workout, activeKettlebell, repPace]);
  const warmup = useMemo(() => warmupFor(workout, activeKettlebell), [workout, activeKettlebell]);
  const timer = useWorkoutTimer(steps);
  const { state, step, remaining, currentRep, pause } = timer;
  const [info, setInfo] = useState<Info | null>(null);
  const completedReportedRef = useRef(false);
  const ready = state.status === "ready";
  const complete = state.status === "complete";
  const paused = state.status === "paused";
  const active = !ready && !complete;
  const isWarmup = step?.kind === "warmup";
  const isRest = step?.kind === "rest";
  const isRepStep = step?.reps !== undefined && currentRep !== undefined;
  const firstExercise = exerciseFor(workout.exercises[0], activeKettlebell);
  const warmupExercise = warmupAt(warmup, state.elapsed);
  const illustration = isWarmup
    ? warmupExercise.movement
    : (step?.exercise?.movement ?? (isRest ? "rest" : firstExercise.movement));
  const next = steps[state.index + 1];
  const totalSets = steps.filter((item) => item.kind === "exercise").length;
  const circumference = 2 * Math.PI * 144;
  const progress = step?.seconds ? Math.min(1, state.elapsed / step.seconds) : 0;
  const isWarningCountdown = !isRepStep && remaining !== undefined && remaining <= 3;
  const repPhaseOffset =
    isRepStep && paceOffset && paceOffset.stepIndex === state.index && paceOffset.pace === repPace
      ? paceOffset.offset
      : 0;

  useEffect(() => {
    if (!visible) pause();
  }, [visible, pause]);
  useEffect(() => {
    if (visible) onFocusChange(!ready);
  }, [visible, ready, onFocusChange]);
  useEffect(() => {
    if (complete && !completedReportedRef.current) {
      completedReportedRef.current = true;
      onComplete?.();
    } else if (ready) {
      completedReportedRef.current = false;
    }
  }, [complete, ready, onComplete]);
  useEffect(() => {
    if (!visible) return;
    document.title = active
      ? isRepStep
        ? `${currentRep}/${step.reps} · ${step.name} — Daily`
        : `${formatTime(remaining ?? state.elapsed)} · ${step.name} — Daily`
      : "Daily — a little stronger";
    return () => {
      document.title = "Daily — a little stronger";
    };
  }, [visible, active, isRepStep, currentRep, step?.reps, remaining, state.elapsed, step?.name]);

  if (!visible) return null;

  function showInfo(value: Info) {
    if (active) timer.pause();
    setInfo(value);
  }
  function startWorkout() {
    setSessionKettlebell(useKettlebell);
    setPaceOffset(null);
    timer.start();
  }
  function resetWorkout() {
    setSessionKettlebell(null);
    setPaceOffset(null);
    timer.reset();
  }
  function toggleKettlebell(enabled: boolean) {
    setLocalKettlebell(enabled);
    if (onKettlebellChange) onKettlebellChange(enabled);
    else saveKettlebellEnabled(enabled);
  }
  function changePace(nextPace: RepPace) {
    if (nextPace === repPace) return;
    timer.flushTick();
    if (active && step?.repSeconds) {
      const nextRepSeconds = buildSteps(workout, activeKettlebell, nextPace)[state.index]?.repSeconds;
      if (nextRepSeconds) {
        const rescaledElapsed = (state.elapsed / step.repSeconds) * nextRepSeconds;
        const offset = Math.round((rescaledElapsed % nextRepSeconds) * 1000) / 1000;
        setPaceOffset({ stepIndex: state.index, pace: nextPace, offset });
      }
    } else {
      setPaceOffset(null);
    }
    if (onRepPaceChange) {
      onRepPaceChange(nextPace);
    } else {
      setLocalRepPace(nextPace);
      saveRepPace(nextPace);
    }
  }

  const detailSlot = typeof info === "object" ? info : null;
  const detail = detailSlot && exerciseFor(detailSlot, activeKettlebell);
  const infoTitle =
    typeof info === "string"
      ? (
          {
            plan: "Workout notes",
            warmup: "Your warm-up",
            form: "A note on form",
            restart: "Restart this workout?",
          } as const
        )[info]
      : (detail?.name ?? "");
  const dialog = info && (
    <InfoDialog title={infoTitle} onClose={() => setInfo(null)}>
      {info === "restart" ? (
        <>
          <p>Start from the beginning? Your current session will be cleared.</p>
          <div className="dialog-actions">
            <button className="text-button" onClick={() => setInfo(null)}>
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() => {
                resetWorkout();
                setInfo(null);
              }}
            >
              Restart workout
            </button>
          </div>
        </>
      ) : info === "warmup" ? (
        <>
          <p>
            Follow these movements for three minutes. Finish with a few easy repetitions of today's exercises, covering
            both sides as needed.
          </p>
          <ul className="warmup-checklist">
            {warmup.map((exercise) => (
              <li key={exercise.name}>
                <span>{exercise.name}</span>
                <strong>{exercise.seconds} sec</strong>
              </li>
            ))}
          </ul>
        </>
      ) : info === "form" ? (
        step.exercise ? (
          <ExerciseGuide exercise={step.exercise} side={step.side} />
        ) : (
          <p>Clear a little space. Keep this tab open and your device awake for countdown sounds.</p>
        )
      ) : info === "plan" ? (
        <>
          <p>{workout.description}</p>
          <p>
            Complete both exercises in Pair 1 for three rounds, then both exercises in Pair 2 for two rounds. Do both
            sides of a one-sided exercise before moving on. Rest for 60–90 seconds after each round except the final
            one. The timer gives you {restSeconds} seconds.
          </p>
          <p>
            Finish each rep-based set with about two clean reps left. When you reach the top of the range on every set,
            make the exercise a little harder. End planks before your hips sag or rotate.
          </p>
          <p>
            Toggle Use 10 kg kettlebell to switch supported exercises between bodyweight and kettlebell variations
            across both workouts.
          </p>
          <p>
            Strength sets pace reps automatically at your chosen speed (Slow, Normal, or Fast), sound a rep cue on each
            rep, and proceed to the next exercise when the target reps finish. Tap Set complete anytime if you finish
            early.
          </p>
          <p>Keep this tab open and your device awake for countdown sounds.</p>
          <p>
            Stop at 25 minutes rather than rushing. Take an extra recovery day if soreness affects technique or
            performance. On climbing days, skip curls and rows; do bridges and planks only if comfortable.
          </p>
        </>
      ) : detailSlot && detail ? (
        <ExerciseGuide key={detail.movement} exercise={detail} />
      ) : null}
    </InfoDialog>
  );

  if (ready)
    return (
      <div className="workout-preview">
        <header className="preview-heading">
          <h1>{workout.heading}</h1>
          <p className="preview-description">{workout.description}</p>
          <div className="preview-facts">
            <span>4 exercises · {workoutMinutes} minutes</span>
            <span className="preview-desktop-fact">{restSeconds} sec rests</span>
            <label className={`kettlebell-toggle ${useKettlebell ? "is-checked" : ""}`}>
              <input
                type="checkbox"
                checked={useKettlebell}
                onChange={(event) => toggleKettlebell(event.target.checked)}
              />
              <Icon name="weight" size={15} />
              <span>Use 10 kg kettlebell</span>
            </label>
          </div>
        </header>
        <div className="preview-actions">
          <button className="text-button preview-help" onClick={() => showInfo("plan")} aria-label="Workout notes">
            <span>Workout notes</span>
            <Icon name="info" size={18} />
          </button>
          <button className="primary-button preview-start" onClick={startWorkout}>
            <Icon name="play" size={21} />
            Start workout
          </button>
        </div>
        <section className="preview-exercises" aria-label="Workout exercises">
          <h2>Your session</h2>
          <button className="preview-exercise preview-warmup" onClick={() => showInfo("warmup")}>
            <span className="exercise-thumbnail">
              <Icon name="sun" size={26} />
            </span>
            <span className="preview-exercise-copy">
              <strong>A little warm-up</strong>
              <small>3 minutes</small>
            </span>
            <Icon name="arrow" size={17} />
          </button>
          {pairRounds.map((rounds, block) => (
            <div className="preview-pair" key={block}>
              <p className="pair-label">
                Pair {block + 1}
                <span>Back-to-back · {rounds} rounds</span>
              </p>
              {workout.exercises.slice(block * 2, block * 2 + 2).map((planned) => {
                const exercise = exerciseFor(planned, useKettlebell);
                return (
                  <button className="preview-exercise" key={planned.movement} onClick={() => showInfo(planned)}>
                    <span className="exercise-thumbnail">
                      <MovementDiagram movement={exercise.movement} phase={2} />
                    </span>
                    <span className="preview-exercise-copy">
                      <strong>{exercise.name}</strong>
                      <small>{exerciseReps(exercise)}</small>
                      <span className="muscle-tags" aria-label={`Targets ${exercise.muscles.join(", ")}`}>
                        {exercise.muscles.map((muscle) => (
                          <span className="muscle-tag" key={muscle}>
                            {muscle}
                          </span>
                        ))}
                      </span>
                    </span>
                    <Icon name="arrow" size={17} />
                  </button>
                );
              })}
            </div>
          ))}
        </section>
        {dialog}
      </div>
    );

  return (
    <section className={`focus-workout ${isRest ? "is-rest" : ""}`} aria-label="Workout timer">
      <header className="focus-top">
        <button className="icon-button" onClick={onBack} aria-label="Back to overview">
          <Icon name="back" size={22} />
        </button>
        <span className="session-context">Daily / Workout {workout.label}</span>
        <button
          className="icon-button"
          onClick={timer.toggleSound}
          aria-label={timer.sound ? "Mute sounds" : "Enable sounds"}
          aria-pressed={timer.sound}
        >
          <Icon name={timer.sound ? "volume" : "mute"} />
        </button>
      </header>
      {complete ? (
        <div className="session-complete">
          <header>
            <span className="session-context">Session complete</span>
            <h1>
              Well done<span className="period">.</span>
            </h1>
            <p>You completed {workout.name.toLowerCase()}.</p>
          </header>
          <div className="celebration-art">
            <svg viewBox="0 0 300 240" aria-hidden="true">
              <circle cx="150" cy="120" r="62" fill="var(--surface)" />
              <path
                d="m126 119 16 16 33-35"
                stroke="var(--accent)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <dl className="completion-stats">
            <div>
              <dt>Pair 1 + Pair 2</dt>
              <dd>{pairRounds.join(" + ")}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(state.totalElapsed)}</dd>
            </div>
            <div>
              <dt>Sets & sides</dt>
              <dd>{totalSets}</dd>
            </div>
          </dl>
          <p className="completion-message">Small sessions. Lasting progress.</p>
          <button
            className="primary-button"
            onClick={() => {
              resetWorkout();
              onBack();
            }}
          >
            Continue
            <Icon name="arrow" />
          </button>
        </div>
      ) : (
        <>
          <div className="focus-content">
            <header className="focus-heading" aria-live="polite">
              <span>
                {paused
                  ? "Paused · take your time"
                  : step.kind === "prepare"
                    ? "Find your space"
                    : isWarmup
                      ? "A little warm-up"
                      : isRest
                        ? `Pair ${step.block} · round ${step.round} complete`
                        : `Pair ${step.block} · Round ${step.round} of ${step.rounds}`}
              </span>
              <h1>{step.name}</h1>
              <p>
                {step.side ? `${step.side} ${step.exercise?.sides} · ` : ""}
                {(step.exercise?.seconds ? `${step.exercise.seconds} sec` : step.exercise?.reps) ??
                  (isWarmup
                    ? "March, squat, circle, then easy reps"
                    : isRest
                      ? "Breathe. Relax your shoulders."
                      : "We’ll start with a 3-minute warm-up")}
              </p>
              {step.exercise && (
                <div className="focus-muscles" aria-label={`Targets ${step.exercise.muscles.join(", ")}`}>
                  {step.exercise.muscles.map((muscle) => (
                    <span className="muscle-tag" key={muscle}>
                      {muscle}
                    </span>
                  ))}
                </div>
              )}
            </header>
            <div className="movement-stage">
              <div className={`movement-ring ${isWarningCountdown ? "last-seconds" : ""}`}>
                <svg className="focus-ring" viewBox="0 0 300 300" aria-hidden="true">
                  <circle cx="150" cy="150" r="144" className="ring-track" />
                  <circle
                    cx="150"
                    cy="150"
                    r="144"
                    className="ring-fill"
                    strokeDasharray={circumference}
                    strokeDashoffset={
                      circumference * (isRepStep ? 1 - progress : step.seconds ? progress : 1 - progress)
                    }
                  />
                </svg>
                <MovementDiagram
                  movement={illustration}
                  playing={!paused}
                  side={step.side}
                  duration={isRepStep ? step.repSeconds : undefined}
                  delay={repPhaseOffset > 0 ? -repPhaseOffset : undefined}
                  motionKey={isRepStep ? `${state.index}-${repPace}` : undefined}
                />
              </div>
            </div>
            <div className={`focus-countdown ${isWarningCountdown ? "last-seconds" : ""}`}>
              {isRepStep ? (
                <>
                  <strong role="timer" aria-label={`Rep ${currentRep} of ${step.reps}`}>
                    {currentRep}
                    <span className="rep-total"> / {step.reps}</span>
                  </strong>
                  <span>
                    {paused
                      ? `Paused · ${formatTime(remaining ?? 0)} left`
                      : `Rep · ${formatTime(remaining ?? 0)} left`}
                  </span>
                </>
              ) : (
                <>
                  <strong role="timer" aria-label="Time remaining">
                    {formatTime(remaining ?? state.elapsed)}
                  </strong>
                  <span>{paused ? "Paused" : "Remaining"}</span>
                </>
              )}
            </div>
            <p className="focus-cue">
              {isWarmup
                ? `${warmupExercise.name}: ${warmupExercise.reps}. ${warmupExercise.cue}`
                : (step.exercise?.cue ??
                  (isRest
                    ? "Let your breathing settle. A fresh set is coming."
                    : activeKettlebell
                      ? "Set your kettlebell nearby and clear a little space."
                      : "Clear a little space and get comfortable."))}
            </p>
          </div>
          <footer className="focus-footer">
            <div className="focus-pace">
              <span className="focus-pace-label">Rep pace</span>
              <div className="scope-pills" role="group" aria-label="Rep pace">
                {REP_PACES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`ed-scope-btn ${repPace === option.id ? "active" : ""}`}
                    aria-pressed={repPace === option.id}
                    onClick={() => changePace(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="focus-controls">
              <button
                className="pause-button"
                onClick={paused ? timer.start : timer.pause}
                aria-label={paused ? "Resume workout" : "Pause"}
              >
                <Icon name={paused ? "play" : "pause"} size={24} />
              </button>
              <button className="primary-button" onClick={timer.advance}>
                {isRepStep
                  ? "Set complete"
                  : isRest
                    ? "Skip rest"
                    : isWarmup
                      ? "Skip warm-up"
                      : step.kind === "exercise"
                        ? "Skip hold"
                        : "Skip countdown"}
                <Icon name={isRepStep ? "check" : "skip"} />
              </button>
            </div>
            <p className="focus-next">
              Up next{" "}
              <strong>
                {next
                  ? `${next.name}${next.side ? ` · ${next.side.toLowerCase()}` : ""}`
                  : "Session complete. You did it."}
              </strong>
            </p>
            <div className="focus-meta">
              <span>{formatTime(state.totalElapsed)} total</span>
              <button className="text-button" onClick={() => showInfo(isWarmup ? "warmup" : "form")}>
                Guide
              </button>
              <button className="text-button" onClick={() => showInfo("restart")}>
                <Icon name="reset" size={15} />
                Restart
              </button>
            </div>
            {timer.audioUnavailable && (
              <p className="audio-note" role="status">
                Audio isn’t available. Follow the visual countdown.
              </p>
            )}
          </footer>
        </>
      )}
      {dialog}
    </section>
  );
}
