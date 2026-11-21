import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import Home from "./Home";
import type { UserProfile } from "./storage";

test.each([
  ["Workout A: Push-ups & abs", "a"],
  ["Workout B: Biceps first", "b"],
  ["Food: daily nutrition plan", "food"],
] as const)("the home button %s opens the correct screen", (name, view) => {
  const navigate = vi.fn();
  render(<Home onNavigate={navigate} />);
  fireEvent.click(screen.getByRole("button", { name }));
  expect(navigate).toHaveBeenCalledWith(view);
});

test("shows the current month calendar, today focus card, logged workouts, navigation, and plan notes", () => {
  const toggleDay = vi.fn();
  const navigate = vi.fn();
  const today = new Date(2026, 10, 21); // Saturday, Nov 21, 2026 -> Workout B
  render(
    <Home
      onNavigate={navigate}
      today={today}
      workoutLog={{ "2026-11-02": "a", "2026-11-03": "b", "2026-11-21": "a" }}
      onToggleDay={toggleDay}
    />,
  );

  const calendar = screen.getByRole("region", { name: "Monthly workout calendar" });
  expect(within(calendar).getByRole("heading", { name: "November 2026" })).toBeTruthy();
  expect(calendar.textContent).toContain("3 / 25 workouts · 2 A / 1 B");
  expect(calendar.textContent).toContain("22 left");

  const focus = screen.getByRole("region", { name: "Today's workout focus" });
  expect(focus.textContent).toContain("Today · Saturday");
  expect(focus.textContent).toContain("Workout B — Biceps first");
  fireEvent.click(within(focus).getByRole("button", { name: "Start session" }));
  expect(navigate).toHaveBeenCalledWith("b");

  const todayButton = within(calendar).getByRole("button", { name: /November 21, 2026: Workout A completed/ });
  expect(todayButton.getAttribute("aria-current")).toBe("date");
  fireEvent.click(todayButton);
  expect(toggleDay).toHaveBeenCalledWith("2026-11-21");

  fireEvent.click(within(calendar).getByRole("button", { name: "Previous month" }));
  expect(within(calendar).getByRole("heading", { name: "October 2026" })).toBeTruthy();
  fireEvent.click(within(calendar).getByRole("button", { name: "Today" }));
  expect(within(calendar).getByRole("heading", { name: "November 2026" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Plan notes" }));
  const dialog = screen.getByRole("dialog", { name: "Your weekly plan" });
  expect(dialog.textContent).toContain("On climbing days, skip curls and rows");
  expect(dialog.textContent).toContain("two rounds of both pairs in week one");
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("body settings update weight, height, weekly workouts, and goal", () => {
  const onProfileChange = vi.fn<(next: UserProfile) => void>();
  render(
    <Home
      onNavigate={vi.fn()}
      profile={{ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 6 }}
      onProfileChange={onProfileChange}
    />,
  );

  const settings = screen.getByRole("region", { name: "Body settings" });
  fireEvent.change(within(settings).getByLabelText("Weight"), { target: { value: "76" } });
  expect(onProfileChange).toHaveBeenLastCalledWith({ weightKg: 76, heightCm: 180, goal: "cut", workoutsPerWeek: 6 });

  fireEvent.change(within(settings).getByLabelText("Height"), { target: { value: "185" } });
  expect(onProfileChange).toHaveBeenLastCalledWith({ weightKg: 88, heightCm: 185, goal: "cut", workoutsPerWeek: 6 });

  fireEvent.click(within(settings).getByRole("button", { name: "3 workouts per week" }));
  expect(onProfileChange).toHaveBeenLastCalledWith({ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 3 });

  fireEvent.click(within(settings).getByRole("button", { name: "Lean build" }));
  expect(onProfileChange).toHaveBeenLastCalledWith({ weightKg: 88, heightCm: 180, goal: "build", workoutsPerWeek: 6 });
});

test("calendar target and today focus adapt to weekly workout frequency", () => {
  const today = new Date(2026, 10, 21); // Saturday, Nov 21, 2026 (rest on 3×/wk)
  render(
    <Home
      onNavigate={vi.fn()}
      today={today}
      profile={{ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 3 }}
    />,
  );
  const calendar = screen.getByRole("region", { name: "Monthly workout calendar" });
  expect(calendar.textContent).toContain("0 / 13 workouts");
  const focus = screen.getByRole("region", { name: "Today's workout focus" });
  expect(focus.textContent).toContain("Rest day");
});
