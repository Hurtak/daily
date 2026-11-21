import { repDurationFor } from "./movementPoses";
import type { RepPace } from "./storage";

export type Movement =
  | "march"
  | "squat"
  | "circles"
  | "pushup"
  | "pike-pushup"
  | "lunge"
  | "goblet-lunge"
  | "press"
  | "crunch"
  | "row"
  | "prone-w"
  | "bridge"
  | "curl"
  | "self-resisted-curl"
  | "plank"
  | "rest";

export interface Exercise {
  name: string;
  reps: string;
  movement: Movement;
  muscles: readonly string[];
  cue: string;
  detail: string;
  sides?: "arm" | "leg" | "side";
  seconds?: number;
  kettlebell?: true;
}

export interface WorkoutExercise extends Exercise {
  kettlebellVariant?: Exercise;
}

export interface Workout {
  id: "a" | "b";
  label: "A" | "B";
  name: string;
  heading: string;
  subtitle: string;
  description: string;
  exercises: [WorkoutExercise, WorkoutExercise, WorkoutExercise, WorkoutExercise];
}

export const pairRounds = [3, 2] as const;
export const workoutMinutes = "20–25";
export const restSeconds = 60;

export const workouts: Workout[] = [
  {
    id: "a",
    label: "A",
    name: "Abs, biceps & shoulders",
    heading: "Workout A: Abs, biceps & shoulders",
    subtitle: "Abs · Biceps · Shoulders",
    description: "Start with abs and biceps. Finish with shoulder work and side planks.",
    exercises: [
      {
        name: "Reverse crunch",
        reps: "10–15 reps",
        movement: "crunch",
        muscles: ["Abs", "Core"],
        cue: "Curl your pelvis up. Lower without swinging your knees.",
        detail:
          "Keep your head and shoulders on the mat and your knees bent. Lift your pelvis slightly off the floor, pause, then lower slowly. Lengthen your legs slightly when the full rep range feels controlled.",
      },
      {
        name: "Self-resisted curl",
        reps: "8–12 reps",
        movement: "self-resisted-curl",
        muscles: ["Biceps", "Forearms"],
        sides: "arm",
        cue: "Curl palm up while your other hand presses against your forearm.",
        detail:
          "Keep the working elbow by your ribs. Press against that forearm with the free hand through the lift and the slow lowering. Use enough resistance to make the last reps challenging while keeping your torso still.",
        kettlebellVariant: {
          name: "One-arm kettlebell curl",
          reps: "6–12 reps",
          movement: "curl",
          muscles: ["Biceps", "Forearms"],
          sides: "arm",
          kettlebell: true,
          cue: "Keep your elbow by your side and curl without swinging.",
          detail:
            "Curl and lower the 10 kg bell with control. Keep your ribs down and avoid swinging your torso to finish the reps.",
        },
      },
      {
        name: "Pike push-up",
        reps: "5–10 reps",
        movement: "pike-pushup",
        muscles: ["Shoulders", "Triceps"],
        cue: "Keep your hips high and lower your head toward the floor.",
        detail:
          "Plant your hands about shoulder-width apart and raise your hips into an inverted V. Bend your elbows as you lower your head toward the floor, then press up with your hips still high. Use a range you can control.",
        kettlebellVariant: {
          name: "One-arm overhead press",
          reps: "6–10 reps",
          movement: "press",
          muscles: ["Shoulders", "Triceps", "Core"],
          sides: "arm",
          kettlebell: true,
          cue: "Keep your ribs down. Press without leaning backward.",
          detail:
            "Brace your core and press the 10 kg kettlebell from the rack to a straight arm overhead. Keep your ribs stacked and avoid leaning back as you fatigue.",
        },
      },
      {
        name: "Side plank",
        reps: "20–30 sec",
        movement: "plank",
        muscles: ["Obliques", "Core", "Glute medius"],
        seconds: 30,
        sides: "side",
        cue: "Keep your elbow below your shoulder and your hips lifted.",
        detail:
          "Stack your hips and hold a straight line on your forearm for 20–30 seconds per side. The timer counts down from 30 seconds. Use Skip hold when you need to end the hold before your hips sag or rotate.",
      },
    ],
  },
  {
    id: "b",
    label: "B",
    name: "Full body",
    heading: "Workout B: Full body",
    subtitle: "Legs · Back · Chest",
    description: "Start with legs and upper back. Finish with push-ups and single-leg glute bridges.",
    exercises: [
      {
        name: "Reverse lunge",
        reps: "8–12 reps",
        movement: "lunge",
        muscles: ["Quads", "Glutes"],
        sides: "leg",
        cue: "Keep the working foot planted. Step back with the other leg.",
        detail:
          "Keep the named leg forward. Step back with the other leg, bend both knees, then stand by pushing through the front foot. Use a controlled range and complete both legs.",
        kettlebellVariant: {
          name: "Goblet reverse lunge",
          reps: "8–12 reps",
          movement: "goblet-lunge",
          muscles: ["Quads", "Glutes"],
          sides: "leg",
          kettlebell: true,
          cue: "Hold the bell at your chest and step back with control.",
          detail:
            "Hold the 10 kg kettlebell against your chest with both hands. Keep the named leg forward, lower under control, then press through the front foot to stand.",
        },
      },
      {
        name: "Prone W raise",
        reps: "10–15 reps",
        movement: "prone-w",
        muscles: ["Upper back", "Rear shoulders"],
        cue: "Lie face down and lift your arms slightly in a W shape.",
        detail:
          "Keep your legs and torso on the mat. Bend your elbows to form a W, squeeze your shoulder blades together, and lift your arms slightly. Lower slowly. The diagram shows the movement from above.",
        kettlebellVariant: {
          name: "Supported one-arm row",
          reps: "10–15 reps",
          movement: "row",
          muscles: ["Lats", "Upper back", "Biceps"],
          sides: "arm",
          kettlebell: true,
          cue: "Brace your free hand. Pull your elbow toward your hip.",
          detail:
            "Support your free hand on a sturdy surface. Keep your torso still as you row the 10 kg kettlebell toward your hip, then lower with control. Complete both arms.",
        },
      },
      {
        name: "Push-up",
        reps: "8–15 reps",
        movement: "pushup",
        muscles: ["Chest", "Shoulders", "Triceps"],
        cue: "Lower as one unit. Press the floor away.",
        detail:
          "Keep your body in one line and your elbows angled back. Use an incline on a sturdy surface if needed. Elevate your feet on a low, stable surface when standard push-ups feel easy at the top of the range.",
      },
      {
        name: "Single-leg glute bridge",
        reps: "10–15 reps",
        movement: "bridge",
        muscles: ["Glutes", "Hamstrings"],
        sides: "leg",
        cue: "Press through your planted foot. Lift your hips with a level pelvis.",
        detail:
          "Lie on your back with the working foot planted and the other leg lifted. Raise your hips while keeping your pelvis level and lower slowly. Start with the other foot lightly assisting if needed.",
      },
    ],
  },
];

type WarmupExercise = Exercise & { seconds: number };

export function exerciseFor(exercise: WorkoutExercise, useKettlebell = false): Exercise {
  return useKettlebell && exercise.kettlebellVariant ? exercise.kettlebellVariant : exercise;
}

export function exerciseReps(exercise: Exercise): string {
  return exercise.sides ? `${exercise.reps} per ${exercise.sides}` : exercise.reps;
}

export function maxRepsFor(exercise: Exercise): number | undefined {
  if (exercise.seconds !== undefined) return undefined;
  const matches = exercise.reps.match(/\d+/g);
  if (!matches?.length) return undefined;
  return Number(matches.at(-1));
}

export function warmupFor(workout: Workout, useKettlebell = false): WarmupExercise[] {
  return [
    {
      name: "Brisk marching",
      reps: "45 sec",
      seconds: 45,
      movement: "march",
      muscles: ["Full body", "Hip flexors"],
      cue: "Stand tall. Alternate your knees and pump the opposite arm.",
      detail: "",
    },
    {
      name: "Bodyweight squats",
      reps: "30 sec",
      seconds: 30,
      movement: "squat",
      muscles: ["Quads", "Glutes"],
      cue: "Sit your hips back. Keep your heels grounded.",
      detail: "",
    },
    {
      name: "Arm circles",
      reps: "45 sec · both directions",
      seconds: 45,
      movement: "circles",
      muscles: ["Shoulders", "Upper back"],
      cue: "Keep your elbows straight. Circle from your shoulders in both directions.",
      detail: "",
    },
    ...workout.exercises.map((planned) => {
      const exercise = exerciseFor(planned, useKettlebell);
      return {
        ...exercise,
        name: `Easy ${exercise.name.toLowerCase()}`,
        reps: exercise.movement === "plank" ? "Short easy holds, both sides" : "A few easy reps",
        seconds: 15,
      };
    }),
  ];
}

export function warmupAt(moves: WarmupExercise[], elapsed: number): WarmupExercise {
  for (const move of moves) {
    if (elapsed < move.seconds) return move;
    elapsed -= move.seconds;
  }
  return moves[moves.length - 1];
}

export interface Step {
  kind: "prepare" | "warmup" | "exercise" | "rest";
  name: string;
  seconds?: number;
  reps?: number;
  repSeconds?: number;
  exercise?: Exercise;
  side?: "Left" | "Right";
  round?: number;
  rounds?: number;
  block?: number;
}

export function buildSteps(workout: Workout, useKettlebell = false, pace: RepPace = "normal"): Step[] {
  const steps: Step[] = [
    { kind: "prepare", name: "Get ready", seconds: 5 },
    {
      kind: "warmup",
      name: "Warm up",
      seconds: warmupFor(workout, useKettlebell).reduce((sum, move) => sum + move.seconds, 0),
    },
  ];
  for (const [block, rounds] of pairRounds.entries()) {
    const exercises = workout.exercises
      .slice(block * 2, block * 2 + 2)
      .map((exercise) => exerciseFor(exercise, useKettlebell));
    for (let round = 1; round <= rounds; round++) {
      for (const exercise of exercises) {
        const reps = maxRepsFor(exercise);
        const repSeconds = reps ? repDurationFor(exercise.movement, pace) : undefined;
        const seconds =
          exercise.seconds ?? (reps && repSeconds ? Math.round(reps * repSeconds * 100) / 100 : undefined);
        for (const side of exercise.sides ? (["Left", "Right"] as const) : [undefined]) {
          steps.push({
            kind: "exercise",
            name: exercise.name,
            exercise,
            seconds,
            reps,
            repSeconds,
            side,
            round,
            rounds,
            block: block + 1,
          });
        }
      }
      if (block !== pairRounds.length - 1 || round !== rounds)
        steps.push({
          kind: "rest",
          name: "Take a breather",
          seconds: restSeconds,
          round,
          rounds,
          block: block + 1,
        });
    }
  }
  return steps;
}
