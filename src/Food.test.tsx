import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import Food from "./Food";
import type { FoodChoices, UserProfile } from "./storage";

test("computes targets, four meals, and daily totals from body settings", () => {
  render(<Food profile={{ weightKg: 88, heightCm: 180, goal: "cut", workoutsPerWeek: 6 }} />);
  const targets = screen.getByRole("region", { name: "Daily nutrition targets" });
  expect(targets.textContent).toContain("140g");
  expect(targets.textContent).toContain("2300kcal");
  expect(targets.textContent).toContain("6 workouts/week");

  const meals = screen.getByRole("region", { name: "Daily meals" });
  expect(within(meals).getAllByRole("heading", { level: 3 })).toHaveLength(4);
  expect(within(meals).getAllByRole("heading", { name: "250 g plain skyr" })).toHaveLength(2);
  expect(meals.textContent).toContain("~140 g protein · ~2300 kcal");
});

test("recomputes targets when weight, height, and weekly workouts change and allows swapping skyr alternatives", () => {
  const onFoodChoicesChange = vi.fn<(next: FoodChoices) => void>();
  const onProfileChange = vi.fn<(next: UserProfile) => void>();
  render(
    <Food
      profile={{ weightKg: 70, heightCm: 170, goal: "maintain", workoutsPerWeek: 6 }}
      onProfileChange={onProfileChange}
      foodChoices={["skyr", "skyr"]}
      onFoodChoicesChange={onFoodChoicesChange}
    />,
  );

  const targets = screen.getByRole("region", { name: "Daily nutrition targets" });
  expect(targets.textContent).toContain("110g");
  expect(targets.textContent).toContain("2350kcal");

  const alternatives = screen.getByRole("region", { name: "Skyr alternatives" });
  fireEvent.click(within(alternatives).getByRole("button", { name: /Greek yogurt/ }));
  expect(onFoodChoicesChange).toHaveBeenLastCalledWith(["greek-yogurt", "greek-yogurt"]);

  fireEvent.click(within(alternatives).getByRole("button", { name: "2nd" }));
  fireEvent.click(within(alternatives).getByRole("button", { name: /Firm tofu/ }));
  expect(onFoodChoicesChange).toHaveBeenLastCalledWith(["skyr", "tofu"]);

  fireEvent.click(screen.getByRole("button", { name: "Edit body settings" }));
  const settingsDialog = screen.getByRole("dialog", { name: "Body settings" });
  fireEvent.change(within(settingsDialog).getByLabelText("Weight"), { target: { value: "82" } });
  expect(onProfileChange).toHaveBeenLastCalledWith({
    weightKg: 82,
    heightCm: 170,
    goal: "maintain",
    workoutsPerWeek: 6,
  });

  fireEvent.click(within(settingsDialog).getByRole("button", { name: "2 workouts per week" }));
  expect(onProfileChange).toHaveBeenLastCalledWith({
    weightKg: 70,
    heightCm: 170,
    goal: "maintain",
    workoutsPerWeek: 2,
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
