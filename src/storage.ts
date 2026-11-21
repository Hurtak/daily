export type WorkoutId = "a" | "b";
export type AppView = "home" | "a" | "b" | "food";
export type NutritionGoal = "cut" | "maintain" | "build";
export type RepPace = "slow" | "normal" | "fast";
export type SkyrOptionId = "skyr" | "greek-yogurt" | "protein-water" | "protein-milk";

export const WEEKDAYS = [
  { day: 0, short: "Mon", name: "Monday" },
  { day: 1, short: "Tue", name: "Tuesday" },
  { day: 2, short: "Wed", name: "Wednesday" },
  { day: 3, short: "Thu", name: "Thursday" },
  { day: 4, short: "Fri", name: "Friday" },
  { day: 5, short: "Sat", name: "Saturday" },
  { day: 6, short: "Sun", name: "Sunday" },
] as const;

export type WorkoutDay = (typeof WEEKDAYS)[number]["day"];

export interface UserProfile {
  weightKg: number;
  heightCm: number;
  goal: NutritionGoal;
  workoutDays: readonly WorkoutDay[];
}

export type WorkoutLog = Record<string, WorkoutId>;

export const DEFAULT_PROFILE: UserProfile = {
  weightKg: 88,
  heightCm: 180,
  goal: "cut",
  workoutDays: [0, 2, 4],
};

export const DEFAULT_FOOD_CHOICE: SkyrOptionId = "skyr";
export const DEFAULT_VIEW: AppView = "home";
export const DEFAULT_REP_PACE: RepPace = "normal";

const PROFILE_KEY = "daily.profile.v1";
const LOG_KEY = "daily.workoutLog.v1";
const FOOD_KEY = "daily.foodChoices.v1";
const BREAKFAST_KEY = "daily.breakfast.v1";
const KETTLEBELL_KEY = "daily.kettlebell.v1";
const VIEW_KEY = "daily.view.v1";
const SOUND_KEY = "daily.sound.v1";
const REP_PACE_KEY = "daily.repPace.v1";

const VALID_GOALS: ReadonlySet<string> = new Set<NutritionGoal>(["cut", "maintain", "build"]);
const VALID_VIEWS: ReadonlySet<string> = new Set<AppView>(["home", "a", "b", "food"]);
const VALID_REP_PACES: ReadonlySet<string> = new Set<RepPace>(["slow", "normal", "fast"]);
const VALID_SKYR_OPTIONS: ReadonlySet<string> = new Set<SkyrOptionId>([
  "skyr",
  "greek-yogurt",
  "protein-water",
  "protein-milk",
]);

// Map older profiles to the same weekdays that their weekly count used.
const LEGACY_TRAINING_DAYS: Partial<Record<number, readonly WorkoutDay[]>> = {
  1: [2], // Wed
  2: [0, 3], // Mon, Thu
  3: DEFAULT_PROFILE.workoutDays,
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

function normalizeWorkoutDays(value: unknown): readonly WorkoutDay[] {
  if (!Array.isArray(value)) return DEFAULT_PROFILE.workoutDays;
  const days = WEEKDAYS.filter(({ day }) => value.includes(day)).map(({ day }) => day);
  return days.length ? days : DEFAULT_PROFILE.workoutDays;
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
  const legacyCount = typeof record.workoutsPerWeek === "number" ? Math.min(7, Math.round(record.workoutsPerWeek)) : 0;
  const workoutDays = normalizeWorkoutDays(record.workoutDays ?? LEGACY_TRAINING_DAYS[legacyCount]);
  return { weightKg, heightCm, goal, workoutDays };
}

export function saveProfile(profile: UserProfile): void {
  writeJson(PROFILE_KEY, {
    weightKg: clampWeight(profile.weightKg),
    heightCm: clampHeight(profile.heightCm),
    goal: VALID_GOALS.has(profile.goal) ? profile.goal : DEFAULT_PROFILE.goal,
    workoutDays: normalizeWorkoutDays(profile.workoutDays),
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

export function loadKettlebellEnabled(): boolean {
  return readJson(KETTLEBELL_KEY) === true;
}

export function saveKettlebellEnabled(enabled: boolean): void {
  writeJson(KETTLEBELL_KEY, enabled);
}

function normalizeFoodChoice(value: unknown): SkyrOptionId {
  if (value === "protein-powder") return "protein-water";
  if (typeof value === "string" && VALID_SKYR_OPTIONS.has(value)) {
    return value as SkyrOptionId;
  }
  return DEFAULT_FOOD_CHOICE;
}

export function loadFoodChoice(): SkyrOptionId {
  const parsed = readJson(FOOD_KEY);
  if (typeof parsed === "string") return normalizeFoodChoice(parsed);
  if (Array.isArray(parsed) && parsed.length > 0) {
    const first = normalizeFoodChoice(parsed[0]);
    if (first !== DEFAULT_FOOD_CHOICE) return first;
    if (parsed.length > 1) return normalizeFoodChoice(parsed[1]);
  }
  return DEFAULT_FOOD_CHOICE;
}

export function saveFoodChoice(choice: SkyrOptionId): void {
  writeJson(FOOD_KEY, choice);
}

export function loadBreakfastEnabled(): boolean {
  return readJson(BREAKFAST_KEY) === true;
}

export function saveBreakfastEnabled(enabled: boolean): void {
  writeJson(BREAKFAST_KEY, enabled);
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

export function loadSoundEnabled(): boolean {
  const parsed = readJson(SOUND_KEY);
  return typeof parsed === "boolean" ? parsed : true;
}

export function saveSoundEnabled(enabled: boolean): void {
  writeJson(SOUND_KEY, enabled);
}

export function loadRepPace(): RepPace {
  const parsed = readJson(REP_PACE_KEY);
  if (typeof parsed === "string" && VALID_REP_PACES.has(parsed)) {
    return parsed as RepPace;
  }
  return DEFAULT_REP_PACE;
}

export function saveRepPace(pace: RepPace): void {
  writeJson(REP_PACE_KEY, pace);
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
  workoutDays: readonly WorkoutDay[] = DEFAULT_PROFILE.workoutDays,
): WorkoutId | "rest" {
  const weekday = (date.getDay() + 6) % 7; // 0 = Mon ... 6 = Sun
  const indexInWeek = workoutDays.findIndex((day) => day === weekday);
  if (indexInWeek === -1) return "rest";

  const utcDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const weekIndex = Math.floor((utcDay - MONDAY_EPOCH_UTC) / (7 * MS_PER_DAY));
  const slot = weekIndex * workoutDays.length + indexInWeek;
  return ((slot % 2) + 2) % 2 === 0 ? "a" : "b";
}

export function workoutScheduleLabel(workoutId: WorkoutId, workoutDays: readonly WorkoutDay[]): string {
  if (workoutDays.length === 7) return "Daily · alt";
  const alternatesByWeek = workoutDays.length % 2 === 1;
  const workoutIndex = workoutId === "a" ? 0 : 1;
  const days = alternatesByWeek ? workoutDays : workoutDays.filter((_, index) => index % 2 === workoutIndex);
  const label = days.map((day) => WEEKDAYS[day].short).join(" / ");
  return alternatesByWeek ? `${label} · alt` : label;
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
  workoutDays: readonly WorkoutDay[] = DEFAULT_PROFILE.workoutDays,
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
    const scheduled = scheduledForDate(date, workoutDays);
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
