export type WorkoutId = "a" | "b";
export type AppView = "home" | "a" | "b" | "food";
export type NutritionGoal = "cut" | "maintain" | "build";
export type SwapScope = "both" | "first" | "second";
export type SkyrOptionId = "skyr" | "quark" | "greek-yogurt" | "cottage-cheese" | "protein-powder" | "tofu" | "tuna";

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  goal: NutritionGoal;
  workoutsPerWeek: number;
}

export type WorkoutLog = Record<string, WorkoutId>;
export type FoodChoices = [SkyrOptionId, SkyrOptionId];

export const DEFAULT_PROFILE: UserProfile = {
  weightKg: 88,
  heightCm: 180,
  goal: "cut",
  workoutsPerWeek: 6,
};

export const DEFAULT_FOOD_CHOICES: FoodChoices = ["skyr", "skyr"];
export const DEFAULT_VIEW: AppView = "home";
export const DEFAULT_SWAP_SCOPE: SwapScope = "both";

const PROFILE_KEY = "daily.profile.v1";
const LOG_KEY = "daily.workoutLog.v1";
const FOOD_KEY = "daily.foodChoices.v1";
const VIEW_KEY = "daily.view.v1";
const SWAP_SCOPE_KEY = "daily.swapScope.v1";
const SOUND_KEY = "daily.sound.v1";

const VALID_GOALS: ReadonlySet<string> = new Set<NutritionGoal>(["cut", "maintain", "build"]);
const VALID_VIEWS: ReadonlySet<string> = new Set<AppView>(["home", "a", "b", "food"]);
const VALID_SWAP_SCOPES: ReadonlySet<string> = new Set<SwapScope>(["both", "first", "second"]);
const VALID_SKYR_OPTIONS: ReadonlySet<string> = new Set<SkyrOptionId>([
  "skyr",
  "quark",
  "greek-yogurt",
  "cottage-cheese",
  "protein-powder",
  "tofu",
  "tuna",
]);

// Recommended training weekdays (0 = Mon ... 6 = Sun) for each weekly frequency.
const WEEKLY_TRAINING_DAYS: Record<number, readonly number[]> = {
  0: [],
  1: [2], // Wed
  2: [0, 3], // Mon, Thu
  3: [0, 2, 4], // Mon, Wed, Fri
  4: [0, 1, 3, 4], // Mon, Tue, Thu, Fri
  5: [0, 1, 2, 4, 5], // Mon, Tue, Wed, Fri, Sat
  6: [0, 1, 2, 3, 4, 5], // Mon–Sat
  7: [0, 1, 2, 3, 4, 5, 6], // Every day
};

const MONDAY_EPOCH_UTC = Date.UTC(2024, 0, 1); // Monday, Jan 1, 2024
const MS_PER_DAY = 86_400_000;

export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PROFILE.weightKg;
  return Math.min(200, Math.max(40, Math.round(value)));
}

export function clampHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PROFILE.heightCm;
  return Math.min(220, Math.max(140, Math.round(value)));
}

export function clampWorkoutsPerWeek(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PROFILE.workoutsPerWeek;
  return Math.min(7, Math.max(0, Math.round(value)));
}

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode failures.
  }
}

export function loadProfile(): UserProfile {
  const parsed = readJson(PROFILE_KEY);
  if (!parsed || typeof parsed !== "object") return DEFAULT_PROFILE;
  const record = parsed as Record<string, unknown>;
  const weightKg = typeof record.weightKg === "number" ? clampWeight(record.weightKg) : DEFAULT_PROFILE.weightKg;
  const heightCm = typeof record.heightCm === "number" ? clampHeight(record.heightCm) : DEFAULT_PROFILE.heightCm;
  const goal =
    typeof record.goal === "string" && VALID_GOALS.has(record.goal)
      ? (record.goal as NutritionGoal)
      : DEFAULT_PROFILE.goal;
  const workoutsPerWeek =
    typeof record.workoutsPerWeek === "number"
      ? clampWorkoutsPerWeek(record.workoutsPerWeek)
      : DEFAULT_PROFILE.workoutsPerWeek;
  return { weightKg, heightCm, goal, workoutsPerWeek };
}

export function saveProfile(profile: UserProfile): void {
  writeJson(PROFILE_KEY, {
    weightKg: clampWeight(profile.weightKg),
    heightCm: clampHeight(profile.heightCm),
    goal: VALID_GOALS.has(profile.goal) ? profile.goal : DEFAULT_PROFILE.goal,
    workoutsPerWeek: clampWorkoutsPerWeek(profile.workoutsPerWeek),
  });
}

export function loadWorkoutLog(): WorkoutLog {
  const parsed = readJson(LOG_KEY);
  if (!parsed || typeof parsed !== "object") return {};
  const result: WorkoutLog = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && (value === "a" || value === "b")) {
      result[key] = value;
    }
  }
  return result;
}

export function saveWorkoutLog(log: WorkoutLog): void {
  writeJson(LOG_KEY, log);
}

export function loadFoodChoices(): FoodChoices {
  const parsed = readJson(FOOD_KEY);
  if (!Array.isArray(parsed) || parsed.length !== 2) return DEFAULT_FOOD_CHOICES;
  const [first, second] = parsed;
  if (
    typeof first === "string" &&
    typeof second === "string" &&
    VALID_SKYR_OPTIONS.has(first) &&
    VALID_SKYR_OPTIONS.has(second)
  ) {
    return [first as SkyrOptionId, second as SkyrOptionId];
  }
  return DEFAULT_FOOD_CHOICES;
}

export function saveFoodChoices(choices: FoodChoices): void {
  writeJson(FOOD_KEY, choices);
}

export function loadActiveView(): AppView {
  const parsed = readJson(VIEW_KEY);
  if (typeof parsed === "string" && VALID_VIEWS.has(parsed)) {
    return parsed as AppView;
  }
  return DEFAULT_VIEW;
}

export function saveActiveView(view: AppView): void {
  writeJson(VIEW_KEY, view);
}

export function loadSwapScope(): SwapScope {
  const parsed = readJson(SWAP_SCOPE_KEY);
  if (typeof parsed === "string" && VALID_SWAP_SCOPES.has(parsed)) {
    return parsed as SwapScope;
  }
  return DEFAULT_SWAP_SCOPE;
}

export function saveSwapScope(scope: SwapScope): void {
  writeJson(SWAP_SCOPE_KEY, scope);
}

export function loadSoundEnabled(): boolean {
  const parsed = readJson(SOUND_KEY);
  return typeof parsed === "boolean" ? parsed : true;
}

export function saveSoundEnabled(enabled: boolean): void {
  writeJson(SOUND_KEY, enabled);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function cycleWorkoutStatus(current: WorkoutId | undefined): WorkoutId | undefined {
  if (current === undefined) return "a";
  if (current === "a") return "b";
  return undefined;
}

export function scheduledForDate(
  date: Date,
  workoutsPerWeek: number = DEFAULT_PROFILE.workoutsPerWeek,
): WorkoutId | "rest" {
  const count = clampWorkoutsPerWeek(workoutsPerWeek);
  const days = WEEKLY_TRAINING_DAYS[count];
  if (days.length === 0) return "rest";

  const weekday = (date.getDay() + 6) % 7; // 0 = Mon ... 6 = Sun
  const indexInWeek = days.indexOf(weekday);
  if (indexInWeek === -1) return "rest";

  const utcDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const weekIndex = Math.floor((utcDay - MONDAY_EPOCH_UTC) / (7 * MS_PER_DAY));
  const slot = weekIndex * count + indexInWeek;
  return ((slot % 2) + 2) % 2 === 0 ? "a" : "b";
}

export function workoutScheduleLabel(workoutId: WorkoutId, workoutsPerWeek: number): string {
  const count = clampWorkoutsPerWeek(workoutsPerWeek);
  switch (count) {
    case 0:
      return "Rest week";
    case 1:
      return "Wed · alt";
    case 2:
      return workoutId === "a" ? "Mon" : "Thu";
    case 3:
      return "Mon / Wed / Fri · alt";
    case 4:
      return workoutId === "a" ? "Mon / Thu" : "Tue / Fri";
    case 5:
      return "5×/wk · alt";
    case 6:
      return workoutId === "a" ? "Mon / Wed / Fri" : "Tue / Thu / Sat";
    case 7:
      return "Daily · alt";
    default:
      return workoutId === "a" ? "Mon / Wed / Fri" : "Tue / Thu / Sat";
  }
}

export interface CalendarCell {
  dateKey: string;
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  scheduled: WorkoutId | "rest";
  label: string;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long" });

export function formatMonthTitle(year: number, month: number): string {
  return MONTH_FORMATTER.format(new Date(year, month, 1));
}

export function formatWeekday(date: Date): string {
  return WEEKDAY_FORMATTER.format(date);
}

export function buildMonthGrid(
  year: number,
  month: number,
  today: Date = new Date(),
  workoutsPerWeek: number = DEFAULT_PROFILE.workoutsPerWeek,
): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayStartOffset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayStartOffset + daysInMonth) / 7) * 7;
  const todayKey = toDateKey(today);
  const cells: CalendarCell[] = [];

  for (let index = 0; index < totalCells; index++) {
    const dayOffset = index - mondayStartOffset;
    const date = new Date(year, month, 1 + dayOffset);
    const inCurrentMonth = date.getMonth() === month;
    const scheduled = scheduledForDate(date, workoutsPerWeek);
    const dateKey = toDateKey(date);
    cells.push({
      dateKey,
      day: date.getDate(),
      inCurrentMonth,
      isToday: dateKey === todayKey,
      scheduled,
      label: DAY_LABEL_FORMATTER.format(date),
    });
  }

  return cells;
}
