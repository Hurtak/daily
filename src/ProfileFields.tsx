import { useId, useState } from "react";
import { clampHeight, clampWeight, WEEKDAYS } from "./storage";
import type { NutritionGoal, UserProfile, WorkoutDay } from "./storage";
import { goalLabels } from "./nutrition";

interface Props {
  profile: UserProfile;
  onChange: (next: UserProfile) => void;
  includeBreakfast?: boolean;
  onBreakfastChange?: (enabled: boolean) => void;
  compact?: boolean;
}

const GOALS: readonly NutritionGoal[] = ["cut", "maintain", "build"];

export default function ProfileFields({
  profile,
  onChange,
  includeBreakfast = false,
  onBreakfastChange = () => {},
  compact = false,
}: Props) {
  const weightId = useId();
  const heightId = useId();
  const breakfastId = useId();
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const [heightDraft, setHeightDraft] = useState<string | null>(null);

  const weightValue = weightDraft ?? String(profile.weightKg);
  const heightValue = heightDraft ?? String(profile.heightCm);
  const { workoutDays } = profile;

  function handleWeightChange(raw: string) {
    setWeightDraft(raw);
    const parsed = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 40 && parsed <= 200) {
      onChange({ ...profile, weightKg: Math.round(parsed) });
    }
  }

  function handleWeightBlur() {
    if (weightDraft !== null) {
      const parsed = Number(weightDraft);
      const nextWeight = weightDraft.trim() === "" ? profile.weightKg : clampWeight(parsed);
      onChange({ ...profile, weightKg: nextWeight });
      setWeightDraft(null);
    }
  }

  function handleHeightChange(raw: string) {
    setHeightDraft(raw);
    const parsed = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 140 && parsed <= 220) {
      onChange({ ...profile, heightCm: Math.round(parsed) });
    }
  }

  function handleHeightBlur() {
    if (heightDraft !== null) {
      const parsed = Number(heightDraft);
      const nextHeight = heightDraft.trim() === "" ? profile.heightCm : clampHeight(parsed);
      onChange({ ...profile, heightCm: nextHeight });
      setHeightDraft(null);
    }
  }

  function toggleWorkoutDay(day: WorkoutDay) {
    const selected = workoutDays.includes(day);
    if (selected && workoutDays.length === 1) return;
    const next = selected ? workoutDays.filter((value) => value !== day) : [...workoutDays, day].sort((a, b) => a - b);
    onChange({ ...profile, workoutDays: next });
  }

  return (
    <div className={`profile-fields ${compact ? "is-compact" : ""}`}>
      <div className="ed-inline-inputs">
        <div className="ed-input-box">
          <label htmlFor={weightId}>Weight</label>
          <div className="ed-input-value">
            <input
              id={weightId}
              type="number"
              inputMode="numeric"
              min={40}
              max={200}
              step={1}
              value={weightValue}
              onChange={(event) => handleWeightChange(event.target.value)}
              onBlur={handleWeightBlur}
            />
            <span className="metric-unit" aria-hidden="true">
              kg
            </span>
          </div>
        </div>
        <div className="ed-input-box">
          <label htmlFor={heightId}>Height</label>
          <div className="ed-input-value">
            <input
              id={heightId}
              type="number"
              inputMode="numeric"
              min={140}
              max={220}
              step={1}
              value={heightValue}
              onChange={(event) => handleHeightChange(event.target.value)}
              onBlur={handleHeightBlur}
            />
            <span className="metric-unit" aria-hidden="true">
              cm
            </span>
          </div>
        </div>
      </div>

      <div className="setting-group" role="group" aria-label="Workout days">
        <div className="setting-group-head">
          <span className="setting-label">Workout days</span>
          <span className="setting-meta">
            {workoutDays.length} / wk{workoutDays.length === 1 && " · minimum"}
          </span>
        </div>
        <div className="ed-weekdays">
          {WEEKDAYS.map(({ day, short, name }) => {
            const selected = workoutDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                className="ed-weekday"
                aria-pressed={selected}
                aria-label={name}
                disabled={selected && workoutDays.length === 1}
                onClick={() => toggleWorkoutDay(day)}
              >
                {short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="setting-group" role="group" aria-label="Nutrition goal">
        <div className="setting-group-head">
          <span className="setting-label">Goal</span>
        </div>
        <div className="ed-chip-row">
          {GOALS.map((goal) => (
            <button
              key={goal}
              type="button"
              className={`ed-chip ${profile.goal === goal ? "is-selected" : ""}`}
              aria-pressed={profile.goal === goal}
              onClick={() => onChange({ ...profile, goal })}
            >
              {goalLabels[goal].label}
            </button>
          ))}
        </div>
        {!compact && <p className="goal-hint">{goalLabels[profile.goal].description}</p>}
      </div>

      <label className={`ed-checkbox-box ${includeBreakfast ? "is-checked" : ""}`} htmlFor={breakfastId}>
        <span className="ed-checkbox-main">
          <input
            id={breakfastId}
            type="checkbox"
            checked={includeBreakfast}
            onChange={(event) => onBreakfastChange(event.target.checked)}
          />
          <span>Eat breakfast</span>
        </span>
        <span className="setting-meta" aria-hidden="true">
          4 eggs · ~25 g
        </span>
      </label>
    </div>
  );
}
