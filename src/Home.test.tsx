import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import Home from "./Home";
import type { UserProfile } from "./storage";

test.each([
  ["Workout A: Abs, biceps & shoulders", "a"],
  ["Workout B: Full body", "b"],
  ["Food: daily nutrition plan", "food"],
] as const)("the home button %s opens the correct screen", (name, view) => {
  const navigate = vi.fn();
  render(<Home onNavigate={navigate} />);
  fireEvent.click(screen.getByRole("button", { name }));
  expect(navigate).toHaveBeenCalledWith(view);
});

test("shows the current month calendar, today focus card, logged workouts, and navigation", () => {
  const toggleDay = vi.fn();
  const navigate = vi.fn();
  const today = new Date(2026, 10, 21); // Saturday, Nov 21, 2026 -> Workout B
  render(
    <Home
      onNavigate={navigate}
      today={today}
      profile={{ weightKg: 88, heightCm: 180, goal: "cut", workoutDays: [0, 1, 2, 3, 4, 5] }}
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
  expect(focus.textContent).toContain("Workout B — Full body");
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

  expect(screen.queryByRole("button", { name: "Plan notes" })).toBeNull();
});

test("body settings update weight, height, selected days, goal, and breakfast", () => {
  const onProfileChange = vi.fn<(next: UserProfile) => void>();
  const onBreakfastChange = vi.fn<(enabled: boolean) => void>();
  const profile: UserProfile = { weightKg: 88, heightCm: 180, goal: "cut", workoutDays: [0, 1, 2, 3, 4, 5] };
  render(
    <Home
      onNavigate={vi.fn()}
      profile={profile}
      onProfileChange={onProfileChange}
      includeBreakfast={false}
      onBreakfastChange={onBreakfastChange}
    />,
  );

  const settings = screen.getByRole("region", { name: "Body settings" });
  fireEvent.change(within(settings).getByLabelText("Weight"), { target: { value: "76" } });
  expect(onProfileChange).toHaveBeenLastCalledWith({ ...profile, weightKg: 76 });

  fireEvent.change(within(settings).getByLabelText("Height"), { target: { value: "185" } });
  expect(onProfileChange).toHaveBeenLastCalledWith({ ...profile, heightCm: 185 });

  fireEvent.click(within(settings).getByRole("button", { name: "Friday" }));
  expect(onProfileChange).toHaveBeenLastCalledWith({ ...profile, workoutDays: [0, 1, 2, 3, 5] });

  const goal = within(settings).getByRole("group", { name: "Nutrition goal" });
  expect(
    within(goal)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Cut", "Maintain", "Build"]);
  fireEvent.click(within(goal).getByRole("button", { name: "Build" }));
  expect(onProfileChange).toHaveBeenLastCalledWith({ ...profile, goal: "build" });

  const breakfast = within(settings).getByRole<HTMLInputElement>("checkbox", { name: "Eat breakfast" });
  expect(breakfast.checked).toBe(false);
  fireEvent.click(breakfast);
  expect(onBreakfastChange).toHaveBeenLastCalledWith(true);
});

test("changing workout days updates the calendar and today's session even at the same weekly count", () => {
  const today = new Date(2026, 10, 21);
  const navigate = vi.fn();
  const profile: UserProfile = { weightKg: 88, heightCm: 180, goal: "cut", workoutDays: [0, 2, 4] };
  const { rerender } = render(<Home onNavigate={navigate} today={today} profile={profile} />);
  const calendar = screen.getByRole("region", { name: "Monthly workout calendar" });
  expect(calendar.textContent).toContain("0 / 13 workouts");
  const focus = screen.getByRole("region", { name: "Today's workout focus" });
  expect(focus.textContent).toContain("Rest day");
  rerender(<Home onNavigate={navigate} today={today} profile={{ ...profile, workoutDays: [1, 3, 5] }} />);
  expect(calendar.textContent).toContain("0 / 12 workouts");
  expect(focus.textContent).toContain("Workout A — Abs, biceps & shoulders");
  expect(screen.getByRole("button", { name: "Workout A: Abs, biceps & shoulders" }).textContent).toContain(
    "Tue / Thu / Sat · alt",
  );
});
