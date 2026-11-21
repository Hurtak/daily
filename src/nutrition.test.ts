import { expect, test } from "vite-plus/test";
import { calculateNutritionPlan, skyrOptions } from "./nutrition";
import {
  buildMonthGrid,
  cycleWorkoutStatus,
  DEFAULT_PROFILE,
  loadActiveView,
  loadFoodChoice,
  loadProfile,
  loadSoundEnabled,
  loadWorkoutLog,
  saveActiveView,
  saveFoodChoice,
  saveProfile,
  saveSoundEnabled,
  saveWorkoutLog,
  scheduledForDate,
  toDateKey,
  workoutScheduleLabel,
} from "./storage";

const sixWorkoutDays = [0, 1, 2, 3, 4, 5] as const;

test("computes daily targets and Prague meat-plate meals for 88 kg, 180 cm, and 6 workouts/week", () => {
  const plan = calculateNutritionPlan({ ...DEFAULT_PROFILE, workoutDays: sixWorkoutDays });
  expect(plan.dailyProteinTarget).toBe(140);
  expect(plan.dailyCalories).toBe(2300);
  expect(plan.workoutsPerWeek).toBe(6);
  expect(plan.bmi).toBe(27.2);
  expect(plan.meals).toHaveLength(4);
  expect(plan.meals[0].name).toBe("270 g plain skyr");
  expect(plan.meals[0].protein).toBe(32);
  expect(plan.meals[1]).toMatchObject({ id: "lunch", protein: 38, calories: 750 });
  expect(plan.meals[3]).toMatchObject({ id: "dinner", protein: 38, calories: 750 });
  expect(plan.dailyProteinTotal).toBe(140);
  expect(plan.dailyCaloriesTotal).toBe(1850);
});

test("new profiles start with three nonconsecutive days and alternate ABA and BAB", () => {
  expect(loadProfile().workoutDays).toEqual([0, 2, 4]);
  const weeks = Array.from({ length: 14 }, (_, day) => scheduledForDate(new Date(2024, 0, 1 + day)));
  expect(weeks.slice(0, 7)).toEqual(["a", "rest", "b", "rest", "a", "rest", "rest"]);
  expect(weeks.slice(7)).toEqual(["b", "rest", "a", "rest", "b", "rest", "rest"]);
});

test("weight, height, goal, and weekly workouts all affect computed daily intake", () => {
  const profile = { ...DEFAULT_PROFILE, workoutDays: sixWorkoutDays };
  const lighter = calculateNutritionPlan({ ...profile, weightKg: 68, heightCm: 170 });
  const taller = calculateNutritionPlan({ ...profile, heightCm: 195 });
  const build = calculateNutritionPlan({ ...profile, goal: "build" });
  const oneWorkout = calculateNutritionPlan({ ...profile, workoutDays: [6] });
  const threeWorkouts = calculateNutritionPlan();
  const sevenWorkouts = calculateNutritionPlan({ ...profile, workoutDays: [...sixWorkoutDays, 6] });

  expect(lighter.dailyProteinTarget).toBeLessThan(140);
  expect(lighter.dailyCalories).toBeLessThan(2300);

  expect(taller.dailyProteinTarget).toBeGreaterThan(140);
  expect(taller.dailyCalories).toBeGreaterThan(2300);

  expect(build.dailyCalories).toBeGreaterThan(2300);
  expect(build.dailyProteinTarget).toBeGreaterThan(140);

  expect(oneWorkout.dailyProteinTarget).toBeLessThan(threeWorkouts.dailyProteinTarget);
  expect(threeWorkouts.dailyProteinTarget).toBeLessThan(140);
  expect(sevenWorkouts.dailyProteinTarget).toBeGreaterThan(140);
  expect(oneWorkout.proteinPerKg).toBeLessThan(sevenWorkouts.proteinPerKg);
});

test("skyr alternatives match the computed protein target per portion", () => {
  const plan = calculateNutritionPlan({ ...DEFAULT_PROFILE, workoutDays: sixWorkoutDays }, "protein-milk");
  expect(plan.alternatives.map((alt) => alt.id)).toEqual(["skyr", "greek-yogurt", "protein-water", "protein-milk"]);
  expect(plan.alternatives).toHaveLength(skyrOptions.length);
  for (const alt of plan.alternatives) {
    expect(Math.abs(alt.protein - plan.snackProteinEach)).toBeLessThanOrEqual(3);
    expect(alt.grams).toBeGreaterThan(0);
    expect(alt.calories).toBeGreaterThan(0);
  }
  const waterShake = plan.alternatives.find((alt) => alt.id === "protein-water")!;
  const milkShake = plan.alternatives.find((alt) => alt.id === "protein-milk")!;
  expect(milkShake.grams).toBeLessThan(waterShake.grams);
  expect(milkShake.calories).toBeGreaterThan(waterShake.calories);
  expect(milkShake.servingLabel).toBe("30 g + 250 ml milk");
  expect(plan.meals[0].name).toBe("30 g protein powder with milk");
  expect(plan.meals[2].name).toBe("30 g protein powder with milk");
  expect(plan.dailyCaloriesTotal).toBe(plan.meals.reduce((total, meal) => total + meal.calories, 0));
  expect(plan.dailyCaloriesTotal).toBe(1960);
});

test("breakfast skips the first protein portion and keeps only the second", () => {
  const defaultWithBreakfast = calculateNutritionPlan(DEFAULT_PROFILE, "skyr", true);
  expect(defaultWithBreakfast.meals.map((meal) => meal.id)).toEqual(["breakfast", "lunch", "snack-2", "dinner"]);
  expect(defaultWithBreakfast.meals[0]).toMatchObject({
    id: "breakfast",
    name: "4 scrambled eggs",
    calories: 288,
    protein: 25,
  });
  expect(defaultWithBreakfast.meals[1]).toMatchObject({ id: "lunch", protein: 38, calories: 750 });
  expect(defaultWithBreakfast.meals[2]).toMatchObject({
    id: "snack-2",
    name: "160 g plain skyr",
    note: "2nd portion",
    slotIndex: 1,
    optionId: "skyr",
  });
  expect(defaultWithBreakfast.meals[3]).toMatchObject({ id: "dinner", protein: 38, calories: 750 });
  expect(defaultWithBreakfast.dailyProteinTotal).toBe(defaultWithBreakfast.dailyProteinTarget);
  expect(defaultWithBreakfast.dailyCaloriesTotal).toBe(1893);

  const smallerProfile = {
    ...DEFAULT_PROFILE,
    weightKg: 70,
    heightCm: 170,
    goal: "maintain" as const,
    workoutDays: sixWorkoutDays,
  };
  const withoutBreakfast = calculateNutritionPlan(smallerProfile, "protein-milk");
  const plan = calculateNutritionPlan(smallerProfile, "protein-milk", true);

  expect(plan.meals.map((meal) => meal.id)).toEqual(["breakfast", "lunch", "snack-2", "dinner"]);
  expect(plan.meals[2]).toMatchObject({ id: "snack-2", slotIndex: 1, optionId: "protein-milk" });
  expect(plan.dailyCalories).toBe(withoutBreakfast.dailyCalories);
  expect(plan.dailyProteinTarget).toBe(withoutBreakfast.dailyProteinTarget);
  expect(plan.dailyCaloriesTotal).toBe(plan.meals.reduce((total, meal) => total + meal.calories, 0));
  expect(plan.dailyProteinTotal).toBeGreaterThanOrEqual(plan.proteinRange[0]);
  expect(plan.dailyProteinTotal).toBeLessThanOrEqual(plan.proteinRange[1]);
  expect(plan.dailyProteinTotal).toBe(plan.meals.reduce((total, meal) => total + meal.protein, 0));
  expect(plan.snackProteinEach).toBeLessThan(withoutBreakfast.snackProteinEach);

  // When main meals already meet or exceed a small daily target, no extra protein portion is forced.
  const tinyTarget = calculateNutritionPlan({ ...DEFAULT_PROFILE, weightKg: 40, heightCm: 140 }, "skyr", true);
  expect(tinyTarget.snackProteinEach).toBe(0);
  expect(tinyTarget.alternatives).toEqual([]);
  expect(tinyTarget.meals.map((meal) => meal.id)).toEqual(["breakfast", "lunch", "dinner"]);
});

test("builds a Monday-started month grid with dynamic weekly recommendations and cycles workout status", () => {
  const today = new Date(2026, 10, 21); // Saturday, Nov 21, 2026
  const cellsSix = buildMonthGrid(2026, 10, today, sixWorkoutDays);
  expect(cellsSix.length % 7).toBe(0);
  const inMonthSix = cellsSix.filter((cell) => cell.inCurrentMonth);
  expect(inMonthSix).toHaveLength(30);
  expect(inMonthSix.filter((cell) => cell.scheduled !== "rest")).toHaveLength(25);
  expect(cellsSix.find((cell) => cell.dateKey === toDateKey(today))?.isToday).toBe(true);
  expect(cellsSix.find((cell) => cell.dateKey === toDateKey(today))?.scheduled).toBe("b");

  // 3 workouts/week (Mon/Wed/Fri) in November 2026 -> 13 recommended sessions alternating A/B, Saturday is rest.
  const cellsThree = buildMonthGrid(2026, 10, today);
  const inMonthThree = cellsThree.filter((cell) => cell.inCurrentMonth);
  const plannedThree = inMonthThree.filter((cell) => cell.scheduled !== "rest");
  expect(plannedThree).toHaveLength(13);
  expect(plannedThree.filter((cell) => cell.scheduled === "a").length).toBeGreaterThanOrEqual(6);
  expect(plannedThree.filter((cell) => cell.scheduled === "b").length).toBeGreaterThanOrEqual(6);
  expect(cellsThree.find((cell) => cell.dateKey === toDateKey(today))?.scheduled).toBe("rest");

  const weekendDays = [5, 6] as const;
  const weekendSessions = buildMonthGrid(2026, 10, today, weekendDays).filter(
    (cell) => cell.inCurrentMonth && cell.scheduled !== "rest",
  );
  expect(weekendSessions.map((cell) => [cell.day, cell.scheduled])).toEqual([
    [1, "b"],
    [7, "a"],
    [8, "b"],
    [14, "a"],
    [15, "b"],
    [21, "a"],
    [22, "b"],
    [28, "a"],
    [29, "b"],
  ]);
  expect(workoutScheduleLabel("a", weekendDays)).toBe("Sat");
  expect(workoutScheduleLabel("b", weekendDays)).toBe("Sun");

  expect(cycleWorkoutStatus(undefined)).toBe("a");
  expect(cycleWorkoutStatus("a")).toBe("b");
  expect(cycleWorkoutStatus("b")).toBeUndefined();
});

test("persists and clamps all app state cleanly in localStorage", () => {
  saveProfile({ weightKg: 79, heightCm: 183, goal: "build", workoutDays: [6, 1, 1] });
  expect(loadProfile()).toEqual({ weightKg: 79, heightCm: 183, goal: "build", workoutDays: [1, 6] });

  saveWorkoutLog({ "2026-11-21": "b", "2026-11-20": "a" });
  expect(loadWorkoutLog()).toEqual({ "2026-11-21": "b", "2026-11-20": "a" });

  saveFoodChoice("protein-milk");
  expect(loadFoodChoice()).toBe("protein-milk");

  localStorage.setItem("daily.foodChoices.v1", JSON.stringify(["skyr", "protein-powder"]));
  expect(loadFoodChoice()).toBe("protein-water");

  localStorage.setItem("daily.foodChoices.v1", JSON.stringify(["quark", "tuna"]));
  expect(loadFoodChoice()).toBe("skyr");

  saveActiveView("food");
  expect(loadActiveView()).toBe("food");

  saveSoundEnabled(false);
  expect(loadSoundEnabled()).toBe(false);
});

test("migrates legacy schedules and gives old zero-day profiles the three-day default", () => {
  const profile = { weightKg: 79, heightCm: 183, goal: "build" } as const;
  localStorage.setItem("daily.profile.v1", JSON.stringify({ ...profile, workoutsPerWeek: 2 }));
  expect(loadProfile()).toEqual({ ...profile, workoutDays: [0, 3] });
  localStorage.setItem("daily.profile.v1", JSON.stringify({ ...profile, workoutsPerWeek: 0 }));
  expect(loadProfile()).toEqual({ ...profile, workoutDays: [0, 2, 4] });
});
