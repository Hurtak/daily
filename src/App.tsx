import { useCallback, useState } from "react";
import Icon from "./Icon";
import InfoDialog from "./InfoDialog";
import ProfileFields from "./ProfileFields";
import Home from "./Home";
import Food from "./Food";
import WorkoutPlayer from "./WorkoutPlayer";
import { workouts } from "./workouts";
import {
  cycleWorkoutStatus,
  loadActiveView,
  loadFoodChoices,
  loadProfile,
  loadSwapScope,
  loadWorkoutLog,
  saveActiveView,
  saveFoodChoices,
  saveProfile,
  saveSwapScope,
  saveWorkoutLog,
  toDateKey,
} from "./storage";
import type { AppView, FoodChoices, SwapScope, UserProfile, WorkoutId, WorkoutLog } from "./storage";

export default function App() {
  const [view, setView] = useState<AppView>(loadActiveView);
  const [focusMode, setFocusMode] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [openedWorkouts, setOpenedWorkouts] = useState<Set<string>>(() =>
    view === "a" || view === "b" ? new Set([view]) : new Set(),
  );
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog>(loadWorkoutLog);
  const [foodChoices, setFoodChoices] = useState<FoodChoices>(loadFoodChoices);
  const [swapScope, setSwapScope] = useState<SwapScope>(loadSwapScope);

  function navigate(next: AppView) {
    setFocusMode(false);
    if (next === "a" || next === "b") setOpenedWorkouts((previous) => new Set(previous).add(next));
    setView(next);
    saveActiveView(next);
  }

  const updateProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    saveProfile(next);
  }, []);

  const updateFoodChoices = useCallback((next: FoodChoices) => {
    setFoodChoices(next);
    saveFoodChoices(next);
  }, []);

  const updateSwapScope = useCallback((next: SwapScope) => {
    setSwapScope(next);
    saveSwapScope(next);
  }, []);

  const toggleDay = useCallback((dateKey: string) => {
    setWorkoutLog((previous) => {
      const next = { ...previous };
      const status = cycleWorkoutStatus(previous[dateKey]);
      if (status) next[dateKey] = status;
      else delete next[dateKey];
      saveWorkoutLog(next);
      return next;
    });
  }, []);

  const recordWorkout = useCallback((workoutId: WorkoutId) => {
    const todayKey = toDateKey(new Date());
    setWorkoutLog((previous) => {
      const next = { ...previous, [todayKey]: workoutId };
      saveWorkoutLog(next);
      return next;
    });
  }, []);

  return (
    <div className={`app-shell ${focusMode ? "training-mode" : ""}`}>
      <header className="site-topbar">
        <button className="brand" onClick={() => navigate("home")} aria-label="Daily home">
          daily<span className="brand-dot">.</span>
        </button>

        <nav className="site-nav" aria-label="Main navigation">
          {(
            [
              { id: "home", label: "Overview", icon: "home" },
              { id: "a", label: "Workout A", icon: "weight" },
              { id: "b", label: "Workout B", icon: "weight" },
              { id: "food", label: "Food", icon: "leaf" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="ed-profile-chip"
          onClick={() => setShowSettingsDialog(true)}
          aria-label="Open body settings"
        >
          <Icon name="settings" size={14} />
          <span>
            {profile.weightKg} kg · {profile.heightCm} cm · {profile.workoutsPerWeek}×/wk
          </span>
        </button>
      </header>

      <main>
        {view === "home" && (
          <Home
            onNavigate={navigate}
            profile={profile}
            onProfileChange={updateProfile}
            workoutLog={workoutLog}
            onToggleDay={toggleDay}
          />
        )}
        {workouts
          .filter((workout) => openedWorkouts.has(workout.id))
          .map((workout) => (
            <WorkoutPlayer
              key={workout.id}
              workout={workout}
              visible={view === workout.id}
              onBack={() => navigate("home")}
              onFocusChange={setFocusMode}
              onComplete={() => recordWorkout(workout.id)}
            />
          ))}
        {view === "food" && (
          <Food
            profile={profile}
            onProfileChange={updateProfile}
            foodChoices={foodChoices}
            onFoodChoicesChange={updateFoodChoices}
            swapScope={swapScope}
            onSwapScopeChange={updateSwapScope}
          />
        )}
      </main>

      <footer className="site-footer">
        <span className="footer-note">10 kg kettlebell</span>
        <span className="footer-stats">Saved locally</span>
      </footer>

      {showSettingsDialog && (
        <InfoDialog title="Settings" onClose={() => setShowSettingsDialog(false)}>
          <p>Updates your weekly schedule, protein target, calories, and meal portions automatically.</p>
          <ProfileFields profile={profile} onChange={updateProfile} />
        </InfoDialog>
      )}
    </div>
  );
}
