import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import App from "./App";

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

test("all navigation screens and the home button work", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("A little stronger.");
  click("Workout A");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Push-ups & abs.");
  expect(screen.getByRole("button", { name: "Workout A" }).getAttribute("aria-current")).toBe("page");
  click("Workout B");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Biceps first.");
  click("Food");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Eat well.");
  click("Daily home");
  expect(screen.getByRole("button", { name: "Workout A: Push-ups & abs" })).toBeTruthy();
});

test("back pauses a workout while the other workout and food remain usable", () => {
  render(<App />);
  click("Workout A");
  click("Start workout");
  click("Skip countdown");
  click("Skip warm-up");
  act(() => {
    vi.advanceTimersByTime(3000);
  });
  click("Back to overview");
  click("Food");
  act(() => {
    vi.advanceTimersByTime(20000);
  });
  click("Workout B");
  expect(screen.getByRole("button", { name: "Start workout" })).toBeTruthy();
  click("Workout A");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Push-ups");
  expect(screen.getByRole("timer").textContent).toBe("00:03");
  expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
});

test("body settings including weekly workouts drive protein targets and all state persists in localStorage", () => {
  const { unmount } = render(<App />);
  const settings = screen.getByRole("region", { name: "Body settings" });
  fireEvent.change(within(settings).getByLabelText("Weight"), { target: { value: "88" } });
  fireEvent.change(within(settings).getByLabelText("Height"), { target: { value: "180" } });
  fireEvent.click(within(settings).getByRole("button", { name: "3 workouts per week" }));

  const calendar = screen.getByRole("region", { name: "Monthly workout calendar" });
  const dayButtons = within(calendar)
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") !== null);
  fireEvent.click(dayButtons[0]);
  expect(calendar.textContent).toContain("1 / ");
  expect(calendar.textContent).toContain("1 A / 0 B");
  fireEvent.click(dayButtons[0]);
  expect(calendar.textContent).toContain("0 A / 1 B");

  click("Food");
  const targets = screen.getByRole("region", { name: "Daily nutrition targets" });
  expect(targets.textContent).toContain("88 kg · 180 cm");
  expect(targets.textContent).toContain("3 workouts/week");
  expect(targets.textContent).toContain("120g");

  const alternatives = screen.getByRole("region", { name: "Skyr alternatives" });
  fireEvent.click(within(alternatives).getByRole("button", { name: "2nd" }));
  fireEvent.click(within(alternatives).getByRole("button", { name: /Cottage cheese/ }));
  const meals = screen.getByRole("region", { name: "Daily meals" });
  expect(meals.textContent).toContain("cottage cheese");

  // Reloading the app restores active view, profile, weekly workouts, food swaps, swap scope, and workout log.
  unmount();
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Eat well.");
  expect(screen.getByRole("region", { name: "Daily nutrition targets" }).textContent).toContain("120g");
  expect(screen.getByRole("region", { name: "Daily meals" }).textContent).toContain("cottage cheese");
  expect(
    within(screen.getByRole("region", { name: "Skyr alternatives" }))
      .getByRole("button", { name: "2nd" })
      .getAttribute("aria-pressed"),
  ).toBe("true");

  click("Overview");
  const reloadedCalendar = screen.getByRole("region", { name: "Monthly workout calendar" });
  expect(reloadedCalendar.textContent).toContain("0 A / 1 B");
  expect(
    within(screen.getByRole("region", { name: "Body settings" }))
      .getByRole("button", { name: "3 workouts per week" })
      .getAttribute("aria-pressed"),
  ).toBe("true");

  // Top-bar profile chip opens settings from any screen and persists updates.
  click("Open body settings");
  const dialog = screen.getByRole("dialog", { name: "Settings" });
  fireEvent.click(within(dialog).getByRole("button", { name: "5 workouts per week" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.getByRole("button", { name: "Open body settings" }).textContent).toContain("5×/wk");
});
