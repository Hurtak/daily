import { useId, useState } from "react";
import { clampHeight, clampWeight } from "./storage";
import type { NutritionGoal, UserProfile } from "./storage";
import { goalLabels } from "./nutrition";

interface Props {
  profile: UserProfile;
  onChange: (next: UserProfile) => void;
  compact?: boolean;
}

const GOALS: readonly NutritionGoal[] = ["cut", "maintain", "build"];
const WEEKLY_COUNTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export default function ProfileFields({ profile, onChange, compact = false }: Props) {
  const weightId = useId();
  const heightId = useId();
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const [heightDraft, setHeightDraft] = useState<string | null>(null);

  const weightValue = weightDraft ?? String(profile.weightKg);
  const heightValue = heightDraft ?? String(profile.heightCm);

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

      <div className="setting-group" role="group" aria-label="Workouts per week">
        <div className="setting-group-head">
          <span className="setting-label">Workouts / week</span>
          <span className="setting-meta">
            {profile.workoutsPerWeek === 0 ? "Rest week" : `${profile.workoutsPerWeek} / wk`}
          </span>
        </div>
        <div className="ed-freq-row">
          {WEEKLY_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              className={`ed-freq-chip ${profile.workoutsPerWeek === count ? "is-selected" : ""}`}
              aria-pressed={profile.workoutsPerWeek === count}
              aria-label={`${count} ${count === 1 ? "workout" : "workouts"} per week`}
              onClick={() => onChange({ ...profile, workoutsPerWeek: count })}
            >
              {count}
            </button>
          ))}
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
    </div>
  );
}
