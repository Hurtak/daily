import { useMemo, useState } from "react";
import Icon from "./Icon";
import InfoDialog from "./InfoDialog";
import ProfileFields from "./ProfileFields";
import { calculateNutritionPlan, goalLabels } from "./nutrition";
import { DEFAULT_PROFILE, loadBreakfastEnabled, loadFoodChoice, saveBreakfastEnabled, saveFoodChoice } from "./storage";
import type { SkyrOptionId, UserProfile } from "./storage";

interface Props {
  profile?: UserProfile;
  onProfileChange?: (next: UserProfile) => void;
  foodChoice?: SkyrOptionId;
  onFoodChoiceChange?: (next: SkyrOptionId) => void;
  includeBreakfast?: boolean;
  onBreakfastChange?: (enabled: boolean) => void;
}

export default function Food({
  profile = DEFAULT_PROFILE,
  onProfileChange = () => {},
  foodChoice: controlledFoodChoice,
  onFoodChoiceChange,
  includeBreakfast: controlledBreakfast,
  onBreakfastChange,
}: Props) {
  const [showNotes, setShowNotes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [internalFoodChoice, setInternalFoodChoice] = useState<SkyrOptionId>(loadFoodChoice);
  const [internalBreakfast, setInternalBreakfast] = useState(loadBreakfastEnabled);

  const foodChoice = controlledFoodChoice ?? internalFoodChoice;
  function updateFoodChoice(next: SkyrOptionId) {
    setInternalFoodChoice(next);
    if (onFoodChoiceChange) onFoodChoiceChange(next);
    else saveFoodChoice(next);
  }

  const includeBreakfast = controlledBreakfast ?? internalBreakfast;
  function updateBreakfast(enabled: boolean) {
    setInternalBreakfast(enabled);
    if (onBreakfastChange) onBreakfastChange(enabled);
    else saveBreakfastEnabled(enabled);
  }

  const plan = useMemo(
    () => calculateNutritionPlan(profile, foodChoice, includeBreakfast),
    [profile, foodChoice, includeBreakfast],
  );

  const activeOption = useMemo(
    () => plan.alternatives.find((item) => item.id === foodChoice) ?? plan.alternatives[0],
    [plan.alternatives, foodChoice],
  );

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
            {plan.weightKg} kg · {plan.heightCm} cm · {plan.workoutsPerWeek}×/wk · {goalLabels[plan.goal].label}
          </span>
        </button>
      </header>

      <div className="food-layout">
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
              <p>{goalLabels[plan.goal].label}</p>
            </div>
          </div>
        </section>

        <section className="ed-panel food-notes" aria-label="Daily meals">
          <div className="meal-plan-heading">
            <h2 className="ed-serif">Daily meals</h2>
            <label className="breakfast-toggle">
              <input
                type="checkbox"
                checked={includeBreakfast}
                onChange={(event) => updateBreakfast(event.target.checked)}
              />
              Breakfast
            </label>
          </div>
          <div className="meal-ledger">
            {plan.meals.map((meal) => (
              <div className="meal-row" key={meal.id}>
                <div className="meal-info">
                  <div className="meal-heading-row">
                    <h3>{meal.name}</h3>
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
              {plan.dailyProteinTotal} g protein · {plan.dailyCaloriesTotal} kcal
            </strong>
          </div>
        </section>

        <section className="ed-panel alternatives-card" aria-labelledby="extra-protein-heading">
          <div className="alternatives-header">
            <div>
              <h2 className="ed-serif" id="extra-protein-heading">
                Extra protein intake
              </h2>
              <p>
                {plan.snackProteinEach === 0
                  ? "Covered by your main meals"
                  : includeBreakfast
                    ? `2nd portion only · ~${plan.snackProteinEach} g protein`
                    : `2 portions · ~${plan.snackProteinEach} g protein each`}
              </p>
            </div>
          </div>

          {activeOption ? (
            <>
              <div className="ed-swap-chips">
                {plan.alternatives.map((item) => {
                  const isSelected = foodChoice === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`ed-chip ed-swap-chip ${isSelected ? "is-selected" : ""}`}
                      onClick={() => updateFoodChoice(item.id)}
                      aria-pressed={isSelected}
                    >
                      <span>
                        {item.shortName} · {item.grams} g
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="swap-details">
                <div className="swap-detail-row">
                  <div className="swap-detail-copy">
                    <div className="swap-detail-head">
                      <strong>{activeOption.name}</strong>
                      <span className="alternative-tag">{activeOption.tag}</span>
                    </div>
                    <p>{activeOption.note}</p>
                  </div>
                  <div className="alternative-amount">
                    <strong>{activeOption.servingLabel}</strong>
                    <span>
                      {activeOption.protein} g · ~{activeOption.calories} kcal
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="swap-covered">
              Your main meals already meet your {plan.dailyProteinTarget} g daily protein target — no extra protein
              portion needed.
            </p>
          )}
        </section>
      </div>

      <button className="text-button food-help" onClick={() => setShowNotes(true)}>
        Food notes &amp; portions
        <Icon name="arrow" size={16} />
      </button>

      {showSettings && (
        <InfoDialog title="Body settings" onClose={() => setShowSettings(false)}>
          <p>Changes update your targets and meal portions live.</p>
          <ProfileFields
            profile={profile}
            onChange={onProfileChange}
            includeBreakfast={includeBreakfast}
            onBreakfastChange={updateBreakfast}
          />
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
          <h3>Extra protein intake</h3>
          <p>
            Lunch and dinner are estimated from an average Prague restaurant meat plate (~150 g raw meat with side and
            sauce: ~{plan.meatMealProteinEach} g protein, ~{plan.meatMealCaloriesEach} kcal each). Plain skyr uses 12 g
            protein per 100 g
            {plan.snackProteinEach > 0
              ? `, and your selection covers the remaining protein across ${
                  includeBreakfast ? "the 2nd portion (breakfast replaces the 1st)" : "both portions"
                } at ~${plan.snackProteinEach} g protein${includeBreakfast ? "" : " each"}.`
              : ". Your main meals already meet your daily protein target, so no extra portion is added."}
          </p>
        </InfoDialog>
      )}
    </div>
  );
}
