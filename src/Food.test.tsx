import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import Food from "./Food";
import type { SkyrOptionId, UserProfile } from "./storage";

test("computes targets, four meals, and daily totals from body settings", () => {
  render(<Food profile={{ weightKg: 88, heightCm: 180, goal: "cut", workoutDays: [0, 1, 2, 3, 4, 5] }} />);
  const targets = screen.getByRole("region", { name: "Daily nutrition targets" });
  expect(targets.textContent).toContain("140g");
  expect(targets.textContent).toContain("2300kcal");
  expect(targets.textContent).toContain("6 workouts/week");

  const meals = screen.getByRole("region", { name: "Daily meals" });
  expect(within(meals).getAllByRole("heading", { level: 3 })).toHaveLength(4);
  expect(within(meals).getAllByRole("heading", { name: "270 g plain skyr" })).toHaveLength(2);
  expect(meals.textContent).toContain("~38 g");
  expect(meals.textContent).toContain("~750 kcal");
  expect(meals.textContent).toContain("140 g protein · 1850 kcal");
  expect(
    screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label") ?? region.querySelector("h2")?.textContent),
  ).toEqual(["Daily nutrition targets", "Daily meals", "Extra protein intake"]);
});

test("recomputes targets when weight, height, and weekly workouts change and applies one choice to both portions", () => {
  const onFoodChoiceChange = vi.fn<(next: SkyrOptionId) => void>();
  const onProfileChange = vi.fn<(next: UserProfile) => void>();
  render(
    <Food
      profile={{ weightKg: 70, heightCm: 170, goal: "maintain", workoutDays: [0, 1, 2, 3, 4, 5] }}
      onProfileChange={onProfileChange}
      foodChoice="skyr"
      onFoodChoiceChange={onFoodChoiceChange}
    />,
  );

  const targets = screen.getByRole("region", { name: "Daily nutrition targets" });
  expect(targets.textContent).toContain("110g");
  expect(targets.textContent).toContain("2350kcal");

  const alternatives = screen.getByRole("region", { name: "Extra protein intake" });
  expect(within(alternatives).queryByRole("group", { name: "Apply swap to" })).toBeNull();
  expect(within(alternatives).queryByRole("button", { name: /Quark|Cottage cheese|Firm tofu|Tuna/ })).toBeNull();
  fireEvent.click(within(alternatives).getByRole("button", { name: /Greek yogurt/ }));
  expect(onFoodChoiceChange).toHaveBeenLastCalledWith("greek-yogurt");

  fireEvent.click(within(alternatives).getByRole("button", { name: /Protein powder with milk/ }));
  expect(onFoodChoiceChange).toHaveBeenLastCalledWith("protein-milk");

  fireEvent.click(within(alternatives).getByRole("button", { name: /Protein powder with water/ }));
  expect(onFoodChoiceChange).toHaveBeenLastCalledWith("protein-water");

  fireEvent.click(screen.getByRole("button", { name: "Edit body settings" }));
  const settingsDialog = screen.getByRole("dialog", { name: "Body settings" });
  fireEvent.change(within(settingsDialog).getByLabelText("Weight"), { target: { value: "82" } });
  expect(onProfileChange).toHaveBeenLastCalledWith({
    weightKg: 82,
    heightCm: 170,
    goal: "maintain",
    workoutDays: [0, 1, 2, 3, 4, 5],
  });

  fireEvent.click(within(settingsDialog).getByRole("button", { name: "Monday" }));
  expect(onProfileChange).toHaveBeenLastCalledWith({
    weightKg: 70,
    heightCm: 170,
    goal: "maintain",
    workoutDays: [1, 2, 3, 4, 5],
  });
});

test("keeps the complete nutrition notes in a dismissible dialog", () => {
  render(<Food />);
  fireEvent.click(screen.getByRole("button", { name: /Food notes & portions/ }));
  const dialog = screen.getByRole("dialog", { name: "Food notes & portions" });
  expect(dialog.textContent).toContain("12 g protein per 100 g");
  expect(dialog.textContent).toContain("Mifflin-St Jeor");
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("breakfast replaces the first protein portion with eggs, keeps only the second, and persists", () => {
  const { unmount } = render(<Food foodChoice="protein-milk" />);
  const meals = within(screen.getByRole("region", { name: "Daily meals" }));
  const alternatives = within(screen.getByRole("region", { name: "Extra protein intake" }));
  const breakfast = meals.getByRole<HTMLInputElement>("checkbox", { name: "Breakfast" });

  expect(breakfast.checked).toBe(false);
  expect(meals.queryByRole("heading", { name: "4 scrambled eggs" })).toBeNull();
  expect(meals.getAllByRole("heading", { name: /protein powder with milk/ })).toHaveLength(2);
  expect(alternatives.getByText(/2 portions/)).toBeTruthy();

  fireEvent.click(breakfast);
  expect(meals.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  const eggs = meals.getByRole("heading", { name: "4 scrambled eggs" }).closest(".meal-row");
  expect(eggs?.textContent).toContain("~25 g");
  expect(eggs?.textContent).toContain("~288 kcal");
  const remainingShake = meals.getAllByRole("heading", { name: /protein powder with milk/ });
  expect(remainingShake).toHaveLength(1);
  expect(remainingShake[0].closest(".meal-row")?.textContent).toContain("2nd portion");
  expect(alternatives.getByText(/2nd portion only/)).toBeTruthy();

  unmount();
  render(<Food foodChoice="protein-milk" />);
  const reloaded = within(screen.getByRole("region", { name: "Daily meals" }));
  const saved = reloaded.getByRole<HTMLInputElement>("checkbox", { name: "Breakfast" });
  expect(saved.checked).toBe(true);
  expect(reloaded.getAllByRole("heading", { name: /protein powder with milk/ })).toHaveLength(1);
  fireEvent.click(saved);
  expect(reloaded.queryByRole("heading", { name: "4 scrambled eggs" })).toBeNull();
  expect(reloaded.getAllByRole("heading", { name: /protein powder with milk/ })).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Edit body settings" }));
  const dialog = screen.getByRole("dialog", { name: "Body settings" });
  const dialogBreakfast = within(dialog).getByRole<HTMLInputElement>("checkbox", { name: "Eat breakfast" });
  expect(dialogBreakfast.checked).toBe(false);
  fireEvent.click(dialogBreakfast);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(reloaded.getByRole<HTMLInputElement>("checkbox", { name: "Breakfast" }).checked).toBe(true);
  expect(reloaded.getByRole("heading", { name: "4 scrambled eggs" })).toBeTruthy();
  expect(reloaded.getAllByRole("heading", { name: /protein powder with milk/ })).toHaveLength(1);
});

test("uncontrolled Food persists foodChoice and omits extra portions when main meals meet a small target", () => {
  const { unmount } = render(<Food />);
  const alternatives = screen.getByRole("region", { name: "Extra protein intake" });
  fireEvent.click(within(alternatives).getByRole("button", { name: /Protein powder with water/ }));
  unmount();

  const second = render(<Food />);
  expect(
    within(screen.getByRole("region", { name: "Extra protein intake" }))
      .getByRole("button", { name: /Protein powder with water/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  second.unmount();

  render(<Food profile={{ weightKg: 40, heightCm: 140, goal: "cut", workoutDays: [0, 2, 4] }} />);
  const covered = screen.getByRole("region", { name: "Extra protein intake" });
  expect(covered.textContent).toContain("Covered by your main meals");
  expect(
    within(screen.getByRole("region", { name: "Daily meals" })).getAllByRole("heading", { level: 3 }),
  ).toHaveLength(2);
});
