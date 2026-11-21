import { expect, test } from "vite-plus/test";
import { calculateNutritionPlan, skyrOptions } from "./nutrition";
import {
  buildMonthGrid,
  clampWorkoutsPerWeek,
  cycleWorkoutStatus,
  loadActiveView,
  loadFoodChoices,
  loadProfile,
  loadSoundEnabled,
  loadSwapScope,
  loadWorkoutLog,
  saveActiveView,
  saveFoodChoices,
  saveProfile,
  saveSoundEnabled,
  saveSwapScope,
  saveWorkoutLog,
  toDateKey,
} from "./storage";

test("computes default daily targets for 88 kg, 180 cm, and 6 workouts/week", () => {
  const plan = calculateNutritionPlan({ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 6 });
  expect(plan.dailyProteinTarget).toBe(140);
  expect(plan.dailyCalories).toBe(2300);
  expect(plan.workoutsPerWeek).toBe(6);
  expect(plan.bmi).toBe(27.2);
  expect(plan.meals).toHaveLength(4);
  expect(plan.meals[0].name).toBe("250 g plain skyr");
  expect(plan.meals[0].protein).toBe(30);
  expect(plan.dailyProteinTotal).toBe(140);
  expect(plan.dailyCaloriesTotal).toBe(2300);
});

test("weight, height, goal, and weekly workouts all affect computed daily intake", () => {
  const lighter = calculateNutritionPlan({ weightKg: 68, heightCm: 170, goal: "cut", workoutsPerWeek: 6 });
  const taller = calculateNutritionPlan({ weightKg: 88, heightCm: 195, goal: "cut", workoutsPerWeek: 6 });
  const build = calculateNutritionPlan({ weightKg: 88, heightCm: 180, goal: "build", workoutsPerWeek: 6 });
  const zeroWorkouts = calculateNutritionPlan({ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 0 });
  const threeWorkouts = calculateNutritionPlan({ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 3 });
  const sevenWorkouts = calculateNutritionPlan({ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 7 });

  expect(lighter.dailyProteinTarget).toBeLessThan(140);
  expect(lighter.dailyCalories).toBeLessThan(2300);

  expect(taller.dailyProteinTarget).toBeGreaterThan(140);
  expect(taller.dailyCalories).toBeGreaterThan(2300);

  expect(build.dailyCalories).toBeGreaterThan(2300);
  expect(build.dailyProteinTarget).toBeGreaterThan(140);

  expect(zeroWorkouts.dailyProteinTarget).toBeLessThan(threeWorkouts.dailyProteinTarget);
  expect(threeWorkouts.dailyProteinTarget).toBeLessThan(140);
  expect(sevenWorkouts.dailyProteinTarget).toBeGreaterThan(140);
  expect(zeroWorkouts.proteinPerKg).toBeLessThan(sevenWorkouts.proteinPerKg);
});

test("skyr alternatives match the computed protein target per portion", () => {
  const plan = calculateNutritionPlan({ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 6 }, [
    "greek-yogurt",
    "tofu",
  ]);
  expect(plan.alternatives).toHaveLength(skyrOptions.length);
  for (const alt of plan.alternatives) {
    expect(Math.abs(alt.protein - plan.snackProteinEach)).toBeLessThanOrEqual(3);
    expect(alt.grams).toBeGreaterThan(0);
    expect(alt.calories).toBeGreaterThan(0);
  }
  expect(plan.meals[0].name).toBe("300 g greek yogurt (0–2%)");
  expect(plan.meals[2].name).toBe("200 g firm tofu");
  expect(plan.dailyCaloriesTotal).toBe(plan.dailyCalories);
});

test("builds a Monday-started month grid with dynamic weekly recommendations and cycles workout status", () => {
  const today = new Date(2026, 10, 21); // Saturday, Nov 21, 2026
  const cellsSix = buildMonthGrid(2026, 10, today, 6);
  expect(cellsSix.length % 7).toBe(0);
  const inMonthSix = cellsSix.filter((cell) => cell.inCurrentMonth);
  expect(inMonthSix).toHaveLength(30);
  expect(inMonthSix.filter((cell) => cell.scheduled !== "rest")).toHaveLength(25);
  expect(cellsSix.find((cell) => cell.dateKey === toDateKey(today))?.isToday).toBe(true);
  expect(cellsSix.find((cell) => cell.dateKey === toDateKey(today))?.scheduled).toBe("b");

  // 3 workouts/week (Mon/Wed/Fri) in November 2026 -> 13 recommended sessions alternating A/B, Saturday is rest.
  const cellsThree = buildMonthGrid(2026, 10, today, 3);
  const inMonthThree = cellsThree.filter((cell) => cell.inCurrentMonth);
  const plannedThree = inMonthThree.filter((cell) => cell.scheduled !== "rest");
  expect(plannedThree).toHaveLength(13);
  expect(plannedThree.filter((cell) => cell.scheduled === "a").length).toBeGreaterThanOrEqual(6);
  expect(plannedThree.filter((cell) => cell.scheduled === "b").length).toBeGreaterThanOrEqual(6);
  expect(cellsThree.find((cell) => cell.dateKey === toDateKey(today))?.scheduled).toBe("rest");

  // 0 workouts/week -> all rest.
  const cellsZero = buildMonthGrid(2026, 10, today, 0);
  expect(cellsZero.filter((cell) => cell.inCurrentMonth && cell.scheduled !== "rest")).toHaveLength(0);

  expect(cycleWorkoutStatus(undefined)).toBe("a");
  expect(cycleWorkoutStatus("a")).toBe("b");
  expect(cycleWorkoutStatus("b")).toBeUndefined();
});

test("persists and clamps all app state cleanly in localStorage", () => {
  expect(clampWorkoutsPerWeek(-2)).toBe(0);
  expect(clampWorkoutsPerWeek(12)).toBe(7);

  saveProfile({ weightKg: 79, heightCm: 183, goal: "build", workoutsPerWeek: 4 });
  expect(loadProfile()).toEqual({ weightKg: 79, heightCm: 183, goal: "build", workoutsPerWeek: 4 });

  saveWorkoutLog({ "2026-11-21": "b", "2026-11-20": "a" });
  expect(loadWorkoutLog()).toEqual({ "2026-11-21": "b", "2026-11-20": "a" });

  saveFoodChoices(["quark", "tuna"]);
  expect(loadFoodChoices()).toEqual(["quark", "tuna"]);

  saveActiveView("food");
  expect(loadActiveView()).toBe("food");

  saveSwapScope("second");
  expect(loadSwapScope()).toBe("second");

  saveSoundEnabled(false);
  expect(loadSoundEnabled()).toBe(false);
});
