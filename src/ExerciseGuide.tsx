import { useState } from "react";
import Icon from "./Icon";
import MovementDiagram from "./MovementDiagram";
import type { Phase } from "./movementPoses";
import { exerciseReps } from "./workouts";
import type { Exercise, Step } from "./workouts";

const positions = [
  { phase: 0, label: "Start" },
  { phase: 1, label: "Midpoint" },
  { phase: 2, label: "Peak" },
] as const;

export default function ExerciseGuide({ exercise, side }: { exercise: Exercise; side?: Step["side"] }) {
  const [motion, setMotion] = useState<Phase | "playing" | "paused">(0);
  const playing = motion === "playing";

  return (
    <>
      <p className="exercise-guide-reps">
        {exerciseReps(exercise)}
        {exercise.kettlebell && <span className="exercise-guide-equipment">10 kg kettlebell</span>}
      </p>
      <div className="exercise-demo">
        <MovementDiagram
          movement={exercise.movement}
          phase={typeof motion === "number" ? motion : undefined}
          playing={playing}
          side={side}
          closeup
        />
        {exercise.seconds === undefined && (
          <div className="exercise-demo-controls">
            <button
              type="button"
              className="text-button exercise-demo-play"
              aria-label={playing ? "Pause demonstration" : "Play demonstration"}
              onClick={() => setMotion(playing ? "paused" : "playing")}
            >
              <Icon name={playing ? "pause" : "play"} size={16} />
              {playing ? "Pause" : "Play"}
            </button>
            <div className="exercise-demo-positions" role="group" aria-label="Rep positions">
              {positions.map(({ phase, label }) => (
                <button
                  type="button"
                  key={phase}
                  className="text-button"
                  aria-pressed={motion === phase}
                  onClick={() => setMotion(phase)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="dialog-muscles" aria-label="Target muscles">
        <span className="muscle-prefix">Targets</span>
        <span className="muscle-tags">
          {exercise.muscles.map((muscle) => (
            <span className="muscle-tag" key={muscle}>
              {muscle}
            </span>
          ))}
        </span>
      </div>
      <p className="exercise-guide-cue">{exercise.cue}</p>
      <p>{exercise.detail}</p>
    </>
  );
}
