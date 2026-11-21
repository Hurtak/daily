import { clampHeight, clampWeight, clampWorkoutsPerWeek, DEFAULT_FOOD_CHOICES, DEFAULT_PROFILE } from "./storage";
import type { FoodChoices, NutritionGoal, SkyrOptionId, UserProfile } from "./storage";

export interface SkyrOption {
  id: SkyrOptionId;
  name: string;
  shortName: string;
  tag: string;
  note: string;
  proteinPer100g: number;
  kcalPer100g: number;
  scoopGrams?: number;
}

export const skyrOptions: readonly SkyrOption[] = [
  {
    id: "skyr",
    name: "Plain skyr",
    shortName: "Plain skyr",
    tag: "Default",
    note: "Lean dairy · typically 10–12 g protein per 100 g.",
    proteinPer100g: 12,
    kcalPer100g: 65,
  },
  {
    id: "quark",
    name: "Low-fat quark",
    shortName: "Quark",
    tag: "Closest",
    note: "Same protein density as skyr; sweet or savory.",
    proteinPer100g: 12,
    kcalPer100g: 68,
  },
  {
    id: "greek-yogurt",
    name: "Greek yogurt (0–2%)",
    shortName: "Greek yogurt",
    tag: "Creamier",
    note: "Slightly larger bowl for the same protein.",
    proteinPer100g: 10,
    kcalPer100g: 73,
  },
  {
    id: "cottage-cheese",
    name: "Cottage cheese",
    shortName: "Cottage cheese",
    tag: "Savory",
    note: "Good with herbs, pepper, or tomatoes.",
    proteinPer100g: 11,
    kcalPer100g: 85,
  },
  {
    id: "protein-powder",
    name: "Whey / plant protein",
    shortName: "Protein shake",
    tag: "Fastest",
    note: "Quick shake with water or milk (~30 g/scoop).",
    proteinPer100g: 75,
    kcalPer100g: 380,
    scoopGrams: 30,
  },
  {
    id: "tofu",
    name: "Firm tofu",
    shortName: "Firm tofu",
    tag: "Dairy-free",
    note: "Plant-based swap; pan-sear or crumble in a bowl.",
    proteinPer100g: 15,
    kcalPer100g: 145,
  },
  {
    id: "tuna",
    name: "Canned tuna in water",
    shortName: "Tuna",
    tag: "Very lean",
    note: "Zero-prep savory option; drain well.",
    proteinPer100g: 24,
    kcalPer100g: 105,
  },
];

export const goalLabels: Record<NutritionGoal, { label: string; shortLabel: string; description: string }> = {
  cut: {
    label: "Lean cut",
    shortLabel: "Cut",
    description: "Modest 400 kcal deficit to shed fat while holding onto muscle.",
  },
  maintain: {
    label: "Maintain",
    shortLabel: "Maintain",
    description: "Steady daily energy to match your routine and recovery.",
  },
  build: {
    label: "Lean build",
    shortLabel: "Build",
    description: "Small 250 kcal surplus to fuel strength and gradual muscle gain.",
  },
};

export interface ComputedAlternative extends SkyrOption {
  grams: number;
  protein: number;
  calories: number;
  servingLabel: string;
}

export interface ComputedMeal {
  id: string;
  name: string;
  note: string;
  protein: number;
  calories: number;
  estimated: boolean;
  slotIndex?: 0 | 1;
  optionId?: SkyrOptionId;
}

export interface NutritionPlan {
  weightKg: number;
  heightCm: number;
  goal: NutritionGoal;
  workoutsPerWeek: number;
  proteinPerKg: number;
  bmi: number;
  maintenanceCalories: number;
  dailyCalories: number;
  calorieRange: [number, number];
  dailyProteinTarget: number;
  proteinRange: [number, number];
  snackProteinEach: number;
  meatMealProteinEach: number;
  meals: ComputedMeal[];
  alternatives: ComputedAlternative[];
  dailyProteinTotal: number;
  dailyCaloriesTotal: number;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function getSkyrOption(id: SkyrOptionId): SkyrOption {
  return skyrOptions.find((option) => option.id === id) ?? skyrOptions[0];
}

function computeServing(option: SkyrOption, targetProtein: number): ComputedAlternative {
  const rawGrams = (targetProtein / option.proteinPer100g) * 100;
  const step = option.proteinPer100g >= 50 ? 5 : 10;
  const grams = Math.max(step, roundTo(rawGrams, step));
  const protein = Math.round((grams * option.proteinPer100g) / 100);
  const calories = roundTo((grams * option.kcalPer100g) / 100, 5);
  let servingLabel = `${grams} g`;
  if (option.scoopGrams) {
    const scoops = Math.round((grams / option.scoopGrams) * 10) / 10;
    servingLabel = `${grams} g (~${scoops} ${scoops === 1 ? "scoop" : "scoops"})`;
  }
  return {
    ...option,
    grams,
    protein,
    calories,
    servingLabel,
  };
}

export function calculateNutritionPlan(
  profile: UserProfile = DEFAULT_PROFILE,
  choices: FoodChoices = DEFAULT_FOOD_CHOICES,
): NutritionPlan {
  const weightKg = clampWeight(profile.weightKg);
  const heightCm = clampHeight(profile.heightCm);
  const goal = profile.goal;
  const workoutsPerWeek = clampWorkoutsPerWeek(profile.workoutsPerWeek);
  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

  // Mifflin-St Jeor neutral adult estimate (age 30 reference) scaled by weekly training frequency.
  const bmr = 10 * weightKg + 6.25 * heightCm - 145;
  const activityMultiplier = 1.27 + workoutsPerWeek * 0.03;
  const maintenanceCalories = Math.max(1500, roundTo(bmr * activityMultiplier, 50));
  const goalDelta = goal === "cut" ? -400 : goal === "build" ? 250 : 0;
  const dailyCalories = Math.max(1400, roundTo(maintenanceCalories + goalDelta, 50));
  const calorieRange: [number, number] = [Math.max(1300, dailyCalories - 100), dailyCalories + 100];

  // Adjust protein weight above BMI 25 and scale protein factor with weekly workout frequency.
  const referenceWeight = 25 * heightM * heightM;
  const effectiveWeight = weightKg > referenceWeight ? referenceWeight + 0.4 * (weightKg - referenceWeight) : weightKg;
  const baseProteinFactor = goal === "cut" ? 1.19 : goal === "build" ? 1.27 : 1.1;
  const proteinPerKg = Math.round((baseProteinFactor + workoutsPerWeek * 0.08) * 100) / 100;
  const dailyProteinTarget = Math.max(60, roundTo(effectiveWeight * proteinPerKg, 5));
  const proteinRange: [number, number] = [Math.max(50, dailyProteinTarget - 10), dailyProteinTarget + 10];

  // Split protein across two main meat meals (~57%) and two quick skyr/alternative portions (~43%).
  const meatMealProteinEach = Math.max(20, roundTo(dailyProteinTarget * 0.285, 5));
  const snackProteinEach = Math.max(12, roundTo((dailyProteinTarget - meatMealProteinEach * 2) / 2, 5));

  const alternatives = skyrOptions.map((option) => computeServing(option, snackProteinEach));
  const byId = new Map(alternatives.map((item) => [item.id, item]));
  const firstSnack = byId.get(choices[0]) ?? alternatives[0];
  const secondSnack = byId.get(choices[1]) ?? alternatives[0];

  const remainingCalories = Math.max(600, dailyCalories - firstSnack.calories - secondSnack.calories);
  const lunchCalories = roundTo(remainingCalories / 2, 10);
  const dinnerCalories = Math.max(300, remainingCalories - lunchCalories);

  const meals: ComputedMeal[] = [
    {
      id: "snack-1",
      name: `${firstSnack.grams} g ${firstSnack.name.toLowerCase()}`,
      note: firstSnack.id === "skyr" ? "1st portion" : `Skyr swap · ${firstSnack.servingLabel}`,
      protein: firstSnack.protein,
      calories: firstSnack.calories,
      estimated: false,
      slotIndex: 0,
      optionId: firstSnack.id,
    },
    {
      id: "lunch",
      name: "Lunch with meat",
      note: "Balanced plate with lean meat or fish.",
      protein: meatMealProteinEach,
      calories: lunchCalories,
      estimated: true,
    },
    {
      id: "snack-2",
      name: `${secondSnack.grams} g ${secondSnack.name.toLowerCase()}`,
      note: secondSnack.id === "skyr" ? "2nd portion" : `Skyr swap · ${secondSnack.servingLabel}`,
      protein: secondSnack.protein,
      calories: secondSnack.calories,
      estimated: false,
      slotIndex: 1,
      optionId: secondSnack.id,
    },
    {
      id: "dinner",
      name: "Dinner with meat",
      note: "Regular meal with lean meat or fish.",
      protein: meatMealProteinEach,
      calories: dinnerCalories,
      estimated: true,
    },
  ];

  const dailyProteinTotal = meals.reduce((sum, meal) => sum + meal.protein, 0);
  const dailyCaloriesTotal = meals.reduce((sum, meal) => sum + meal.calories, 0);

  return {
    weightKg,
    heightCm,
    goal,
    workoutsPerWeek,
    proteinPerKg,
    bmi,
    maintenanceCalories,
    dailyCalories,
    calorieRange,
    dailyProteinTarget,
    proteinRange,
    snackProteinEach,
    meatMealProteinEach,
    meals,
    alternatives,
    dailyProteinTotal,
    dailyCaloriesTotal,
  };
}

const defaultPlan = calculateNutritionPlan(DEFAULT_PROFILE, DEFAULT_FOOD_CHOICES);
export const dailyProteinTarget = defaultPlan.dailyProteinTarget;
export const meals = defaultPlan.meals;
export const dailyProteinTotal = defaultPlan.dailyProteinTotal;
