import { useMemo, useState } from "react";
import Icon from "./Icon";
import InfoDialog from "./InfoDialog";
import ProfileFields from "./ProfileFields";
import { calculateNutritionPlan, goalLabels, skyrOptions } from "./nutrition";
import { DEFAULT_FOOD_CHOICES, DEFAULT_PROFILE, DEFAULT_SWAP_SCOPE } from "./storage";
import type { FoodChoices, SkyrOptionId, SwapScope, UserProfile } from "./storage";

interface Props {
  profile?: UserProfile;
  onProfileChange?: (next: UserProfile) => void;
  foodChoices?: FoodChoices;
  onFoodChoicesChange?: (next: FoodChoices) => void;
  swapScope?: SwapScope;
  onSwapScopeChange?: (next: SwapScope) => void;
}

export default function Food({
  profile = DEFAULT_PROFILE,
  onProfileChange = () => {},
  foodChoices = DEFAULT_FOOD_CHOICES,
  onFoodChoicesChange = () => {},
  swapScope: controlledSwapScope,
  onSwapScopeChange,
}: Props) {
  const [showNotes, setShowNotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [internalSwapScope, setInternalSwapScope] = useState<SwapScope>(DEFAULT_SWAP_SCOPE);

  const swapScope = controlledSwapScope ?? internalSwapScope;
  function updateSwapScope(next: SwapScope) {
    setInternalSwapScope(next);
    onSwapScopeChange?.(next);
  }

  const plan = useMemo(() => calculateNutritionPlan(profile, foodChoices), [profile, foodChoices]);

  const activeDetails = useMemo(() => {
    const first = plan.alternatives.find((item) => item.id === foodChoices[0]) ?? plan.alternatives[0];
    const second = plan.alternatives.find((item) => item.id === foodChoices[1]) ?? plan.alternatives[0];
    return first.id === second.id ? [first] : [first, second];
  }, [plan.alternatives, foodChoices]);

  function applyAlternative(id: SkyrOptionId) {
    if (swapScope === "both") {
      onFoodChoicesChange([id, id]);
    } else if (swapScope === "first") {
      onFoodChoicesChange([id, foodChoices[1]]);
    } else {
      onFoodChoicesChange([foodChoices[0], id]);
    }
  }

  function changeSlot(slotIndex: 0 | 1, id: SkyrOptionId) {
    const next: FoodChoices = slotIndex === 0 ? [id, foodChoices[1]] : [foodChoices[0], id];
    onFoodChoicesChange(next);
  }

  return (
    <div className="food-page">
      <header className="food-heading">
        <h1 className="ed-serif">Eat well.</h1>
        <button
          type="button"
          className="profile-pill"
          onClick={() => setShowSettings(true)}
          aria-label="Edit body settings"
        >
          <Icon name="settings" size={14} />
          <span>
            {plan.weightKg} kg · {plan.heightCm} cm · {plan.workoutsPerWeek}×/wk · {goalLabels[plan.goal].shortLabel}
          </span>
        </button>
      </header>

      <div className="food-layout">
        <div className="food-left-column">
          <section className="ed-panel protein-card" aria-label="Daily nutrition targets">
            <div className="sheet-header">
              <h2 className="ed-serif">Daily targets</h2>
              <p>
                {plan.weightKg} kg · {plan.heightCm} cm (BMI {plan.bmi}) · {plan.workoutsPerWeek}{" "}
                {plan.workoutsPerWeek === 1 ? "workout" : "workouts"}/week
              </p>
            </div>
            <div className="targets-grid">
              <div className="target-block is-protein">
                <h3>Protein</h3>
                <div className="protein-target ed-serif">
                  {plan.dailyProteinTarget}
                  <span>g</span>
                </div>
                <p>
                  {plan.proteinRange[0]}–{plan.proteinRange[1]} g · {plan.proteinPerKg} g/kg
                </p>
              </div>
              <div className="target-block is-energy">
                <h3>Energy</h3>
                <div className="protein-target ed-serif">
                  {plan.dailyCalories}
                  <span>kcal</span>
                </div>
                <p>
                  {goalLabels[plan.goal].shortLabel} · {plan.maintenanceCalories} maint.
                </p>
              </div>
            </div>
          </section>

          <section className="ed-panel alternatives-card" aria-label="Skyr alternatives">
            <div className="alternatives-header">
              <div>
                <h2 className="ed-serif">Skyr swaps</h2>
                <p>~{plan.snackProteinEach} g protein per portion</p>
              </div>
              <div className="scope-pills" role="group" aria-label="Apply swap to">
                {(
                  [
                    { id: "both", label: "Both" },
                    { id: "first", label: "1st" },
                    { id: "second", label: "2nd" },
                  ] as const
                ).map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className={`ed-scope-btn ${swapScope === scope.id ? "active" : ""}`}
                    aria-pressed={swapScope === scope.id}
                    onClick={() => updateSwapScope(scope.id)}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ed-swap-chips">
              {plan.alternatives.map((item) => {
                const inFirst = foodChoices[0] === item.id;
                const inSecond = foodChoices[1] === item.id;
                const isSelected = inFirst || inSecond;
                const slotBadge = inFirst && inSecond ? null : inFirst ? "1st" : inSecond ? "2nd" : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`ed-chip ed-swap-chip ${isSelected ? "is-selected" : ""}`}
                    onClick={() => applyAlternative(item.id)}
                    aria-pressed={isSelected}
                  >
                    <span>
                      {item.shortName} · {item.grams} g
                    </span>
                    {slotBadge && <span className="ed-chip-slot">{slotBadge}</span>}
                  </button>
                );
              })}
            </div>

            <div className="swap-details">
              {activeDetails.map((item, idx) => (
                <div className="swap-detail-row" key={item.id}>
                  <div className="swap-detail-copy">
                    <div className="swap-detail-head">
                      <strong>{item.name}</strong>
                      <span className="alternative-tag">{item.tag}</span>
                      {activeDetails.length > 1 && (
                        <span className="alternative-active">{idx === 0 ? "1st" : "2nd"}</span>
                      )}
                    </div>
                    <p>{item.note}</p>
                  </div>
                  <div className="alternative-amount">
                    <strong>{item.servingLabel}</strong>
                    <span>
                      {item.protein} g · ~{item.calories} kcal
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="ed-panel food-notes" aria-label="Daily meals">
          <h2 className="ed-serif">Daily meals</h2>
          <div className="meal-ledger">
            {plan.meals.map((meal) => (
              <div className="meal-row" key={meal.id}>
                <div className="meal-info">
                  <div className="meal-heading-row">
                    <h3>{meal.name}</h3>
                    {meal.slotIndex !== undefined && meal.optionId && (
                      <label className="meal-swap-label">
                        <span className="sr-only">
                          Choose {meal.slotIndex === 0 ? "first" : "second"} high-protein portion
                        </span>
                        <select
                          className="meal-swap-select"
                          aria-label={meal.slotIndex === 0 ? "First portion choice" : "Second portion choice"}
                          value={meal.optionId}
                          onChange={(event) => changeSlot(meal.slotIndex!, event.target.value as SkyrOptionId)}
                        >
                          {skyrOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.shortName}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <p>{meal.note}</p>
                </div>
                <div className={`meal-macros ${meal.slotIndex !== undefined ? "is-snack" : ""}`}>
                  <strong>
                    {meal.estimated ? "~" : ""}
                    {meal.protein} <span>g</span>
                  </strong>
                  <span className="meal-kcal">~{meal.calories} kcal</span>
                </div>
              </div>
            ))}
          </div>
          <div className="meal-total">
            <span>Total</span>
            <strong>
              ~{plan.dailyProteinTotal} g protein · ~{plan.dailyCaloriesTotal} kcal
            </strong>
          </div>
        </section>
      </div>

      <button className="text-button food-help" onClick={() => setShowNotes(true)}>
        Food notes &amp; portions
        <Icon name="arrow" size={16} />
      </button>

      {showSettings && (
        <InfoDialog title="Body settings" onClose={() => setShowSettings(false)}>
          <p>Changes update your targets and meal portions live.</p>
          <ProfileFields profile={profile} onChange={onProfileChange} />
        </InfoDialog>
      )}

      {showNotes && (
        <InfoDialog title="Food notes & portions" onClose={() => setShowNotes(false)}>
          <h3>How targets are computed</h3>
          <p>
            Energy uses a Mifflin-St Jeor estimate for {plan.weightKg} kg, {plan.heightCm} cm, and{" "}
            {plan.workoutsPerWeek} {plan.workoutsPerWeek === 1 ? "workout" : "workouts"}/week (~
            {plan.maintenanceCalories} kcal maintenance), adjusted for {goalLabels[plan.goal].label.toLowerCase()}.
          </p>
          <p>
            Protein scales from lean-adjusted weight and weekly workouts ({plan.proteinPerKg} g/kg →{" "}
            {plan.proteinRange[0]}–{plan.proteinRange[1]} g/day).
          </p>
          <h3>Skyr &amp; swaps</h3>
          <p>
            Plain skyr uses 12 g protein per 100 g. Every swap scales to ~{plan.snackProteinEach} g protein per portion,
            and main-meal calorie budgets adjust automatically.
          </p>
        </InfoDialog>
      )}
    </div>
  );
}
