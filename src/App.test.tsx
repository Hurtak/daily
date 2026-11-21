import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import App from "./App";

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

test("all navigation screens and the home button work", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Overview");
  expect(within(screen.getByRole("banner")).queryByRole("button", { name: /settings/i })).toBeNull();
  click("Workout A");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Workout A: Abs, biceps & shoulders");
  expect(screen.getByRole("button", { name: "Workout A" }).getAttribute("aria-current")).toBe("page");
  click("Workout B");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Workout B: Full body");
  click("Food");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Eat well.");
  click("Daily home");
  expect(screen.getByRole("button", { name: "Workout A: Abs, biceps & shoulders" })).toBeTruthy();
});

test("back pauses a workout while the other workout and food remain usable", () => {
  render(<App />);
  click("Workout A");
  click("Start workout");
  click("Skip countdown");
  click("Skip warm-up");
  act(() => {
    vi.advanceTimersByTime(4000);
  });
  click("Back to overview");
  click("Food");
  act(() => {
    vi.advanceTimersByTime(20000);
  });
  click("Workout B");
  expect(screen.getByRole("button", { name: "Start workout" })).toBeTruthy();
  click("Workout A");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Reverse crunch");
  expect(screen.getByRole("timer").textContent).toBe("2 / 15");
  expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
});

test("selected workout days drive protein targets and persist across settings and reloads", () => {
  const { unmount } = render(<App />);
  const settings = screen.getByRole("region", { name: "Body settings" });
  fireEvent.change(within(settings).getByLabelText("Weight"), { target: { value: "88" } });
  fireEvent.change(within(settings).getByLabelText("Height"), { target: { value: "180" } });
  const dayButton = (name: string) => within(settings).getByRole<HTMLButtonElement>("button", { name });
  fireEvent.click(dayButton("Wednesday"));
  fireEvent.click(dayButton("Friday"));
  expect(dayButton("Monday").disabled).toBe(true);
  fireEvent.click(dayButton("Monday"));
  expect(dayButton("Monday").getAttribute("aria-pressed")).toBe("true");
  for (const name of ["Tuesday", "Thursday", "Saturday", "Monday"]) fireEvent.click(dayButton(name));

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

  const alternatives = screen.getByRole("region", { name: "Extra protein intake" });
  fireEvent.click(within(alternatives).getByRole("button", { name: /Protein powder with milk/ }));
  const meals = screen.getByRole("region", { name: "Daily meals" });
  expect(within(meals).getAllByRole("heading", { name: /protein powder with milk/ })).toHaveLength(2);

  // Reloading the app restores active view, profile, selected days, and workout log.
  unmount();
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Eat well.");
  expect(screen.getByRole("region", { name: "Daily nutrition targets" }).textContent).toContain("120g");
  expect(
    within(screen.getByRole("region", { name: "Daily meals" })).getAllByRole("heading", {
      name: /protein powder with milk/,
    }),
  ).toHaveLength(2);
  expect(
    within(screen.getByRole("region", { name: "Extra protein intake" }))
      .getByRole("button", { name: /Protein powder with milk/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");

  click("Overview");
  const reloadedCalendar = screen.getByRole("region", { name: "Monthly workout calendar" });
  expect(reloadedCalendar.textContent).toContain("0 A / 1 B");
  const reloadedDays = within(screen.getByRole("group", { name: "Workout days" }));
  expect(reloadedDays.getAllByRole("button", { pressed: true }).map((button) => button.textContent)).toEqual([
    "Tue",
    "Thu",
    "Sat",
  ]);

  click("Food");
  click("Edit body settings");
  const dialog = screen.getByRole("dialog", { name: "Body settings" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Sunday" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.getByRole("region", { name: "Daily nutrition targets" }).textContent).toContain("4 workouts/week");
});

test("toggling eat breakfast in overview settings syncs with Food and persists across reloads", () => {
  const { unmount } = render(<App />);
  const settings = screen.getByRole("region", { name: "Body settings" });
  const overviewCheckbox = within(settings).getByRole<HTMLInputElement>("checkbox", { name: "Eat breakfast" });
  expect(overviewCheckbox.checked).toBe(false);
  fireEvent.click(overviewCheckbox);
  expect(overviewCheckbox.checked).toBe(true);

  click("Food");
  const meals = within(screen.getByRole("region", { name: "Daily meals" }));
  expect(meals.getByRole<HTMLInputElement>("checkbox", { name: "Breakfast" }).checked).toBe(true);
  expect(meals.getByRole("heading", { name: "4 scrambled eggs" })).toBeTruthy();

  unmount();
  render(<App />);
  const reloadedMeals = within(screen.getByRole("region", { name: "Daily meals" }));
  expect(reloadedMeals.getByRole<HTMLInputElement>("checkbox", { name: "Breakfast" }).checked).toBe(true);

  click("Overview");
  const reloadedOverview = within(screen.getByRole("region", { name: "Body settings" }));
  expect(reloadedOverview.getByRole<HTMLInputElement>("checkbox", { name: "Eat breakfast" }).checked).toBe(true);
});

test("kettlebell checkbox state is shared between Workout A and Workout B and persists across reloads", () => {
  const { unmount } = render(<App />);
  click("Workout A");
  const checkboxA = screen.getByRole<HTMLInputElement>("checkbox", { name: /Use 10 kg kettlebell/ });
  expect(checkboxA.checked).toBe(false);
  expect(screen.getByRole("button", { name: /Self-resisted curl/ })).toBeTruthy();

  fireEvent.click(checkboxA);
  expect(checkboxA.checked).toBe(true);
  expect(screen.getByRole("button", { name: /One-arm kettlebell curl/ })).toBeTruthy();

  click("Workout B");
  const checkboxB = screen.getByRole<HTMLInputElement>("checkbox", { name: /Use 10 kg kettlebell/ });
  expect(checkboxB.checked).toBe(true);
  expect(screen.getByRole("button", { name: /Goblet reverse lunge/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Supported one-arm row/ })).toBeTruthy();

  unmount();
  render(<App />);
  expect(screen.getByRole<HTMLInputElement>("checkbox", { name: /Use 10 kg kettlebell/ }).checked).toBe(true);
  expect(screen.getByRole("button", { name: /Supported one-arm row/ })).toBeTruthy();

  fireEvent.click(screen.getByRole("checkbox", { name: /Use 10 kg kettlebell/ }));
  click("Workout A");
  expect(screen.getByRole<HTMLInputElement>("checkbox", { name: /Use 10 kg kettlebell/ }).checked).toBe(false);
  expect(screen.getByRole("button", { name: /Self-resisted curl/ })).toBeTruthy();
});

test("changing kettlebell or rep pace in one workout preserves a paused session in the other", () => {
  render(<App />);
  click("Workout B");
  fireEvent.click(screen.getByRole("checkbox", { name: /Use 10 kg kettlebell/ }));
  click("Start workout");
  // Advance to the final step of kettlebell Workout B (step 24 of 24: Single-leg glute bridge · Right).
  for (let count = 0; count < 23; count++) {
    click(/^(Set complete|Skip rest|Skip warm-up|Skip countdown|Skip hold)$/);
  }
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Single-leg glute bridge");
  expect(screen.getByText(/Right leg/, { selector: ".focus-heading p" })).toBeTruthy();
  // Advance to rep 10 at normal pace (3.4s/rep * 9.5 = 32.3s), then pause via Back.
  act(() => {
    vi.advanceTimersByTime(32_300);
  });
  expect(screen.getByRole("timer").textContent).toBe("10 / 15");
  click("Back to overview");

  // Uncheck kettlebell on Workout A preview, start Workout A, and change rep pace to Fast.
  click("Workout A");
  fireEvent.click(screen.getByRole("checkbox", { name: /Use 10 kg kettlebell/ }));
  click("Start workout");
  fireEvent.click(within(screen.getByRole("group", { name: "Rep pace" })).getByRole("button", { name: "Fast" }));
  click("Back to overview");

  // Returning to Workout B keeps its active kettlebell session and rescales rep 10 cleanly to Fast pace.
  click("Workout B");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Single-leg glute bridge");
  expect(screen.getByRole("timer").textContent).toBe("10 / 15");
  click("Resume workout");
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Single-leg glute bridge");
  expect(screen.getByRole("timer").textContent).toBe("10 / 15");
});
