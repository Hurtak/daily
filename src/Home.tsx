import { useMemo, useState } from "react";
import Icon from "./Icon";
import MovementDiagram from "./MovementDiagram";
import ProfileFields from "./ProfileFields";
import { pairRounds, workoutMinutes, workouts } from "./workouts";
import { calculateNutritionPlan } from "./nutrition";
import {
  buildMonthGrid,
  DEFAULT_PROFILE,
  formatMonthTitle,
  formatWeekday,
  loadBreakfastEnabled,
  saveBreakfastEnabled,
  scheduledForDate,
  toDateKey,
  WEEKDAYS,
  workoutScheduleLabel,
} from "./storage";
import type { UserProfile, WorkoutLog } from "./storage";

interface Props {
  onNavigate: (view: "a" | "b" | "food") => void;
  profile?: UserProfile;
  onProfileChange?: (next: UserProfile) => void;
  includeBreakfast?: boolean;
  onBreakfastChange?: (enabled: boolean) => void;
  workoutLog?: WorkoutLog;
  onToggleDay?: (dateKey: string) => void;
  today?: Date;
}

export default function Home({
  onNavigate,
  profile = DEFAULT_PROFILE,
  onProfileChange = () => {},
  includeBreakfast: controlledBreakfast,
  onBreakfastChange,
  workoutLog = {},
  onToggleDay = () => {},
  today,
}: Props) {
  const [defaultToday] = useState(() => new Date());
  const referenceToday = today ?? defaultToday;
  const [internalBreakfast, setInternalBreakfast] = useState(loadBreakfastEnabled);
  const [monthCursor, setMonthCursor] = useState(() => ({
    year: referenceToday.getFullYear(),
    month: referenceToday.getMonth(),
  }));

  const includeBreakfast = controlledBreakfast ?? internalBreakfast;
  function updateBreakfast(enabled: boolean) {
    setInternalBreakfast(enabled);
    if (onBreakfastChange) onBreakfastChange(enabled);
    else saveBreakfastEnabled(enabled);
  }

  const plan = useMemo(() => calculateNutritionPlan(profile, undefined, includeBreakfast), [profile, includeBreakfast]);
  const { workoutDays } = profile;
  const cells = useMemo(
    () => buildMonthGrid(monthCursor.year, monthCursor.month, referenceToday, workoutDays),
    [monthCursor.year, monthCursor.month, referenceToday, workoutDays],
  );
  const monthTitle = formatMonthTitle(monthCursor.year, monthCursor.month);
  const isCurrentMonth =
    monthCursor.year === referenceToday.getFullYear() && monthCursor.month === referenceToday.getMonth();
  const todayKey = toDateKey(referenceToday);
  const todayWeekday = formatWeekday(referenceToday);
  const todayScheduled = scheduledForDate(referenceToday, workoutDays);
  const todayLogged = workoutLog[todayKey];
  const focusWorkout =
    todayScheduled === "rest" ? undefined : workouts.find((workout) => workout.id === todayScheduled);

  const monthStats = useMemo(() => {
    let a = 0;
    let b = 0;
    let target = 0;
    for (const cell of cells) {
      if (!cell.inCurrentMonth) continue;
      if (cell.scheduled !== "rest") target++;
      const done = workoutLog[cell.dateKey];
      if (done === "a") a++;
      if (done === "b") b++;
    }
    const total = a + b;
    const progress = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
    return { total, a, b, target, remaining: Math.max(0, target - total), progress };
  }, [cells, workoutLog]);

  function shiftMonth(delta: number) {
    setMonthCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div className="home-page">
      <h1>Overview</h1>

      <div className="ed-grid">
        <div className="ed-main-col">
          <section className="ed-panel month-card" aria-label="Monthly workout calendar">
            <div className="month-header">
              <div className="month-title-group">
                <h2 className="ed-serif">{monthTitle}</h2>
                <p className="month-summary">
                  {monthStats.target === 0
                    ? `Rest plan · ${monthStats.total} logged`
                    : `${monthStats.total} / ${monthStats.target} workouts · ${monthStats.a} A / ${monthStats.b} B`}
                </p>
              </div>
              <div className="month-controls">
                {!isCurrentMonth && (
                  <button
                    type="button"
                    className="text-button month-today-btn"
                    onClick={() =>
                      setMonthCursor({ year: referenceToday.getFullYear(), month: referenceToday.getMonth() })
                    }
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  className="icon-button month-nav-btn"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                >
                  <Icon name="chevronLeft" size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button month-nav-btn"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                >
                  <Icon name="chevronRight" size={16} />
                </button>
              </div>
            </div>

            {monthStats.target > 0 && (
              <div className="month-progress-row" aria-label={`Monthly goal progress: ${monthStats.progress}%`}>
                <div className="month-progress-track">
                  <div className="month-progress-fill" style={{ inlineSize: `${monthStats.progress}%` }} />
                </div>
                <span className="month-progress-label">
                  {monthStats.remaining === 0 ? "Goal met" : `${monthStats.remaining} left`}
                </span>
              </div>
            )}

            <div className="month-weekdays" aria-hidden="true">
              {WEEKDAYS.map(({ day, short }) => (
                <span key={day}>{short}</span>
              ))}
            </div>

            <div className="month-grid" role="grid" aria-label={`${monthTitle} workouts`}>
              {cells.map((cell) => {
                if (!cell.inCurrentMonth) {
                  return <div className="month-cell is-outside" key={cell.dateKey} aria-hidden="true" />;
                }
                const logged = workoutLog[cell.dateKey];
                const planClass = !logged && cell.scheduled !== "rest" ? `plan-${cell.scheduled}` : "";
                const statusText = logged
                  ? `Workout ${logged.toUpperCase()} completed`
                  : cell.scheduled === "rest"
                    ? "Rest day"
                    : `Recommended Workout ${cell.scheduled.toUpperCase()}`;
                return (
                  <button
                    type="button"
                    key={cell.dateKey}
                    className={`month-cell ${cell.isToday ? "is-today" : ""} ${logged ? `is-done done-${logged}` : planClass}`}
                    onClick={() => onToggleDay(cell.dateKey)}
                    aria-label={`${cell.label}: ${statusText}`}
                    aria-pressed={Boolean(logged)}
                    aria-current={cell.isToday ? "date" : undefined}
                  >
                    <span className="month-day-num">{cell.day}</span>
                    {logged ? (
                      <span className="month-day-badge" aria-hidden="true">
                        {logged.toUpperCase()}
                      </span>
                    ) : (
                      <span className="month-day-plan" aria-hidden="true">
                        {cell.scheduled === "rest" ? "·" : cell.scheduled.toUpperCase()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="month-legend">
              <div className="legend-items">
                <span>
                  <i className="legend-swatch swatch-a" aria-hidden="true" />A
                </span>
                <span>
                  <i className="legend-swatch swatch-b" aria-hidden="true" />B
                </span>
                <span>
                  <i className="legend-swatch swatch-plan" aria-hidden="true" />
                  Planned ({workoutDays.length}×/wk)
                </span>
              </div>
              <span className="legend-hint">Tap day to log</span>
            </div>
          </section>

          <section className="workout-cards" aria-label="Choose your workout">
            {workouts.map((workout) => {
              const doneToday = todayLogged === workout.id;
              return (
                <button
                  className={`ed-panel workout-card card-${workout.id}`}
                  onClick={() => onNavigate(workout.id)}
                  key={workout.id}
                  aria-label={`Workout ${workout.label}: ${workout.name}`}
                >
                  <div className="card-body">
                    <div className="card-label-row">
                      <span className={`workout-label tag-${workout.id}`}>Workout {workout.label}</span>
                      {doneToday && (
                        <span className="done-pill">
                          <Icon name="check" size={12} />
                          Done
                        </span>
                      )}
                    </div>
                    <h3 className="ed-serif">{workout.name}</h3>
                    <p>{workout.subtitle}</p>
                    <span className="card-days">{workoutScheduleLabel(workout.id, workoutDays)}</span>
                  </div>
                  <div className="card-art">
                    <MovementDiagram movement={workout.id === "a" ? "crunch" : "curl"} phase={0} />
                  </div>
                  <div className="card-meta">
                    <span>
                      <Icon name="clock" size={14} />
                      {workoutMinutes} min
                    </span>
                    <span>{pairRounds.join("+")} rounds</span>
                    <span className="card-cta">
                      Start
                      <Icon name="arrow" size={14} />
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        </div>

        <div className="ed-side">
          <section className="ed-focus-card" aria-label="Today's workout focus">
            <div className="ed-focus-top">
              <span className="ed-kicker">Today · {todayWeekday}</span>
              {todayLogged && (
                <span className="ed-focus-done">
                  <Icon name="check" size={12} />
                  Done ({todayLogged.toUpperCase()})
                </span>
              )}
            </div>
            {focusWorkout ? (
              <>
                <h2 className="ed-serif">
                  Workout {focusWorkout.label} — {focusWorkout.name}
                </h2>
                <p className="ed-focus-sub">
                  {focusWorkout.subtitle} · {workoutMinutes} min
                </p>
                <div className="ed-focus-actions">
                  <button type="button" className="ed-focus-btn" onClick={() => onNavigate(focusWorkout.id)}>
                    Start session
                    <Icon name="arrow" size={15} />
                  </button>
                  <button
                    type="button"
                    className="ed-focus-link"
                    onClick={() => onNavigate(focusWorkout.id === "a" ? "b" : "a")}
                  >
                    Do {focusWorkout.id === "a" ? "B" : "A"} instead
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="ed-serif">Rest day</h2>
                <p className="ed-focus-sub">Walk &amp; recover · target {plan.dailyProteinTarget} g protein.</p>
                <div className="ed-focus-actions">
                  <button type="button" className="ed-focus-btn" onClick={() => onNavigate("food")}>
                    Food plan
                    <Icon name="arrow" size={15} />
                  </button>
                  <button type="button" className="ed-focus-link" onClick={() => onNavigate("a")}>
                    Train anyway
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="ed-panel settings-card" aria-label="Body settings">
            <div className="settings-card-header">
              <h2 className="ed-serif">Settings</h2>
              <Icon name="settings" size={16} />
            </div>
            <ProfileFields
              profile={profile}
              onChange={onProfileChange}
              includeBreakfast={includeBreakfast}
              onBreakfastChange={updateBreakfast}
              compact
            />
          </section>

          <button
            className="ed-panel food-banner"
            onClick={() => onNavigate("food")}
            aria-label="Food: daily nutrition plan"
          >
            <span className="food-banner-copy">
              <strong className="ed-serif">Food plan</strong>
            </span>
            <span className="food-banner-metrics">
              <span className="food-banner-target is-protein">
                <strong className="ed-serif">
                  {plan.dailyProteinTarget}
                  <span>g</span>
                </strong>
                <span>protein</span>
              </span>
              <span className="food-banner-divider" aria-hidden="true" />
              <span className="food-banner-target is-energy">
                <strong className="ed-serif">{plan.dailyCalories}</strong>
                <span>kcal</span>
              </span>
            </span>
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
