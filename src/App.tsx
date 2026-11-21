import { useCallback, useState } from "react";
import Icon from "./Icon";
import Home from "./Home";
import Food from "./Food";
import WorkoutPlayer from "./WorkoutPlayer";
import { workouts } from "./workouts";
import {
  cycleWorkoutStatus,
  loadActiveView,
  loadBreakfastEnabled,
  loadFoodChoice,
  loadKettlebellEnabled,
  loadProfile,
  loadRepPace,
  loadWorkoutLog,
  saveActiveView,
  saveBreakfastEnabled,
  saveFoodChoice,
  saveKettlebellEnabled,
  saveProfile,
  saveRepPace,
  saveWorkoutLog,
  toDateKey,
} from "./storage";
import type { AppView, RepPace, SkyrOptionId, UserProfile, WorkoutId, WorkoutLog } from "./storage";

export default function App() {
  const [view, setView] = useState<AppView>(loadActiveView);
  const [focusMode, setFocusMode] = useState(false);
  const [openedWorkouts, setOpenedWorkouts] = useState<Set<string>>(() =>
    view === "a" || view === "b" ? new Set([view]) : new Set(),
  );
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog>(loadWorkoutLog);
  const [foodChoice, setFoodChoice] = useState<SkyrOptionId>(loadFoodChoice);
  const [includeBreakfast, setIncludeBreakfast] = useState(loadBreakfastEnabled);
  const [useKettlebell, setUseKettlebell] = useState(loadKettlebellEnabled);
  const [repPace, setRepPace] = useState<RepPace>(loadRepPace);

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

  const updateFoodChoice = useCallback((next: SkyrOptionId) => {
    setFoodChoice(next);
    saveFoodChoice(next);
  }, []);

  const updateBreakfast = useCallback((enabled: boolean) => {
    setIncludeBreakfast(enabled);
    saveBreakfastEnabled(enabled);
  }, []);

  const updateKettlebell = useCallback((enabled: boolean) => {
    setUseKettlebell(enabled);
    saveKettlebellEnabled(enabled);
  }, []);

  const updateRepPace = useCallback((next: RepPace) => {
    setRepPace(next);
    saveRepPace(next);
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
      </header>

      <main>
        {view === "home" && (
          <Home
            onNavigate={navigate}
            profile={profile}
            onProfileChange={updateProfile}
            includeBreakfast={includeBreakfast}
            onBreakfastChange={updateBreakfast}
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
              useKettlebell={useKettlebell}
              onKettlebellChange={updateKettlebell}
              repPace={repPace}
              onRepPaceChange={updateRepPace}
            />
          ))}
        {view === "food" && (
          <Food
            profile={profile}
            onProfileChange={updateProfile}
            foodChoice={foodChoice}
            onFoodChoiceChange={updateFoodChoice}
            includeBreakfast={includeBreakfast}
            onBreakfastChange={updateBreakfast}
          />
        )}
      </main>
    </div>
  );
}
