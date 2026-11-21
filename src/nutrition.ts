import { clampHeight, clampWeight, DEFAULT_FOOD_CHOICE, DEFAULT_PROFILE } from "./storage";
import type { NutritionGoal, SkyrOptionId, UserProfile } from "./storage";

export interface SkyrOption {
  id: SkyrOptionId;
  name: string;
  shortName: string;
  tag: string;
  note: string;
  proteinPer100g: number;
  kcalPer100g: number;
  scoopGrams?: number;
  milk?: {
    mlPerScoop: number;
    proteinPer100ml: number;
    kcalPer100ml: number;
  };
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
    id: "greek-yogurt",
    name: "Greek yogurt (0–2%)",
    shortName: "Greek yogurt",
    tag: "Creamier",
    note: "Slightly larger bowl for the same protein.",
    proteinPer100g: 10,
    kcalPer100g: 73,
  },
  {
    id: "protein-water",
    name: "Protein powder with water",
    shortName: "Protein powder with water",
    tag: "Fastest",
    note: "Quick, lean shake mixed with water (~30 g/scoop).",
    proteinPer100g: 75,
    kcalPer100g: 380,
    scoopGrams: 30,
  },
  {
    id: "protein-milk",
    name: "Protein powder with milk",
    shortName: "Protein powder with milk",
    tag: "Richer",
    note: "Creamier shake with semi-skimmed milk (1.5%, ~30 g/scoop).",
    proteinPer100g: 75,
    kcalPer100g: 380,
    scoopGrams: 30,
    milk: {
      mlPerScoop: 250,
      proteinPer100ml: 3.4,
      kcalPer100ml: 47,
    },
  },
];

export const goalLabels: Record<NutritionGoal, { label: string; description: string }> = {
  cut: {
    label: "Cut",
    description: "Modest 400 kcal deficit to shed fat while holding onto muscle.",
  },
  maintain: {
    label: "Maintain",
    description: "Steady daily energy to match your routine and recovery.",
  },
  build: {
    label: "Build",
    description: "Small 250 kcal surplus to fuel strength and gradual muscle gain.",
  },
};

export interface ComputedAlternative extends SkyrOption {
  grams: number;
  milkMl?: number;
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

// USDA SR 28, NDB 01123, for four large eggs at 50 g each.
const EGG_BREAKFAST: ComputedMeal = {
  id: "breakfast",
  name: "4 scrambled eggs",
  note: "Four large eggs, scrambled without added fat or milk.",
  protein: 25,
  calories: 288,
  estimated: true,
};

// Average Prague restaurant lunch plate ("polední menu"): ~150 g raw meat + ~200–250 g side + sauce/oil.
const PRAGUE_MEAT_MEAL = {
  protein: 38,
  calories: 750,
} as const;

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
  meatMealCaloriesEach: number;
  meals: ComputedMeal[];
  alternatives: ComputedAlternative[];
  dailyProteinTotal: number;
  dailyCaloriesTotal: number;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function computeServing(option: SkyrOption, targetProtein: number): ComputedAlternative {
  const milkPerGram = option.milk && option.scoopGrams ? option.milk.mlPerScoop / option.scoopGrams : 0;
  const effectiveProteinPer100g = option.proteinPer100g + milkPerGram * (option.milk?.proteinPer100ml ?? 0);
  const rawGrams = (targetProtein / effectiveProteinPer100g) * 100;
  const step = option.proteinPer100g >= 50 ? 5 : 10;
  const grams = Math.max(step, roundTo(rawGrams, step));
  const milkMl = option.milk && milkPerGram > 0 ? Math.max(25, roundTo(grams * milkPerGram, 25)) : undefined;
  const protein = Math.round(
    (grams * option.proteinPer100g) / 100 + ((milkMl ?? 0) * (option.milk?.proteinPer100ml ?? 0)) / 100,
  );
  const calories = roundTo(
    (grams * option.kcalPer100g) / 100 + ((milkMl ?? 0) * (option.milk?.kcalPer100ml ?? 0)) / 100,
    5,
  );
  let servingLabel = `${grams} g`;
  if (milkMl !== undefined) {
    servingLabel = `${grams} g + ${milkMl} ml milk`;
  } else if (option.scoopGrams) {
    const scoops = Math.round((grams / option.scoopGrams) * 10) / 10;
    servingLabel = `${grams} g (~${scoops} ${scoops === 1 ? "scoop" : "scoops"})`;
  }
  return {
    ...option,
    grams,
    milkMl,
    protein,
    calories,
    servingLabel,
  };
}

export function calculateNutritionPlan(
  profile: UserProfile = DEFAULT_PROFILE,
  foodChoice: SkyrOptionId = DEFAULT_FOOD_CHOICE,
  includeBreakfast = false,
): NutritionPlan {
  const weightKg = clampWeight(profile.weightKg);
  const heightCm = clampHeight(profile.heightCm);
  const goal = profile.goal;
  const workoutsPerWeek = profile.workoutDays.length;
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

  const breakfast = includeBreakfast ? EGG_BREAKFAST : undefined;
  const snackCount = breakfast ? 1 : 2;
  const meatMealProteinEach = PRAGUE_MEAT_MEAL.protein;
  const meatMealCaloriesEach = PRAGUE_MEAT_MEAL.calories;
  const remainingProtein = dailyProteinTarget - (breakfast?.protein ?? 0) - meatMealProteinEach * 2;
  const minimumSnackProtein = 5;
  // Breakfast replaces the first extra-protein portion; omit extra portions when main meals already meet the target.
  const snackProteinEach =
    remainingProtein > 0 ? Math.max(minimumSnackProtein, Math.round(remainingProtein / snackCount)) : 0;

  const alternatives =
    snackProteinEach > 0 ? skyrOptions.map((option) => computeServing(option, snackProteinEach)) : [];
  const snack = alternatives.find((item) => item.id === foodChoice) ?? alternatives[0];

  const makeSnackMeal = (id: "snack-1" | "snack-2", slotIndex: 0 | 1): ComputedMeal => {
    const label = slotIndex === 0 ? "1st portion" : "2nd portion";
    return {
      id,
      name: `${snack.grams} g ${snack.name.toLowerCase()}`,
      note: snack.id === "skyr" ? label : `${label} · ${snack.servingLabel}`,
      protein: snack.protein,
      calories: snack.calories,
      estimated: false,
      slotIndex,
      optionId: snack.id,
    };
  };

  const meals: ComputedMeal[] = [
    ...(breakfast ? [breakfast] : snack ? [makeSnackMeal("snack-1", 0)] : []),
    {
      id: "lunch",
      name: "Lunch with meat",
      note: "Average Prague lunch plate (~150 g raw meat with side & sauce).",
      protein: meatMealProteinEach,
      calories: meatMealCaloriesEach,
      estimated: true,
    },
    ...(snack ? [makeSnackMeal("snack-2", 1)] : []),
    {
      id: "dinner",
      name: "Dinner with meat",
      note: "Prague lunch-sized meat plate (~150 g raw meat with side & sauce).",
      protein: meatMealProteinEach,
      calories: meatMealCaloriesEach,
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
    meatMealCaloriesEach,
    meals,
    alternatives,
    dailyProteinTotal,
    dailyCaloriesTotal,
  };
}
