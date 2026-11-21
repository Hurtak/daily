import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import WorkoutPlayer from "./WorkoutPlayer";
import { workouts } from "./workouts";
import type { Workout } from "./workouts";

function mount(workout: Workout = workouts[0]) {
  const props = {
    workout,
    visible: true,
    onBack: vi.fn(),
    onFocusChange: vi.fn(),
    onComplete: vi.fn(),
  };
  return { ...render(<WorkoutPlayer {...props} />), props };
}
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const elapse = (seconds: number) =>
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });
function advanceTo(name: string) {
  for (let count = 0; count < 35; count++) {
    if (screen.getByRole("heading", { level: 1 }).textContent === name) return;
    click(/^(Set complete|Skip rest|Skip warm-up|Skip countdown|Skip hold)$/);
  }
  throw new Error(`Did not reach ${name}`);
}

test.each(workouts)("previews every exercise, its target muscles, and form notes for $name", (workout) => {
  mount(workout);
  expect(screen.getByRole("heading", { name: workout.heading })).toBeTruthy();
  expect(screen.queryByText(`Workout ${workout.label}`)).toBeNull();
  for (const exercise of workout.exercises) {
    const button = screen.getByRole("button", { name: new RegExp(exercise.name) });
    for (const muscle of exercise.muscles) {
      expect(button.textContent).toContain(muscle);
    }
    fireEvent.click(button);
    const dialog = screen.getByRole("dialog", { name: exercise.name });
    expect(dialog.textContent).toContain(exercise.detail);
    for (const muscle of exercise.muscles) {
      expect(dialog.textContent).toContain(muscle);
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  }
  click("Workout notes");
  expect(screen.getByRole("dialog").textContent).toContain("two rounds");
});

test("preparation leads to warm-up, cycles the guide, and pauses while reading help", () => {
  const { props } = mount();
  click("Start workout");
  expect(props.onFocusChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("timer").textContent).toBe("00:05");
  elapse(5);
  expect(screen.getByRole("heading", { name: "Warm up" })).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toBe("03:00");
  expect(screen.getByRole("img", { name: "march movement illustration" })).toBeTruthy();
  elapse(45);
  expect(screen.getByRole("img", { name: "squat movement illustration" })).toBeTruthy();
  click("Guide");
  const dialog = screen.getByRole("dialog", { name: "Your warm-up" });
  expect(within(dialog).getAllByRole("listitem")).toHaveLength(7);
  elapse(10);
  expect(screen.getByRole("timer").textContent).toBe("02:15");
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
});

test("rep sets count up to max reps, auto-proceed to the next exercise, and still allow early completion", () => {
  mount();
  click("Start workout");
  advanceTo("Reverse crunch");
  expect(screen.getByRole("timer").textContent).toBe("1 / 15");
  elapse(3.5);
  expect(screen.getByRole("timer").textContent).toBe("2 / 15");
  // Finish all 15 reps (14 remaining * 3.5s = 49s) -> auto-proceeds to Self-resisted curl (Left arm).
  elapse(49);
  expect(screen.getByRole("heading", { name: "Self-resisted curl" })).toBeTruthy();
  expect(screen.getByText(/Left arm/, { selector: ".focus-heading p" })).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toBe("1 / 12");
  // Early manual completion still works cleanly.
  click("Set complete");
  expect(screen.getByText(/Right arm/, { selector: ".focus-heading p" })).toBeTruthy();
  click("Set complete");
  expect(screen.getByRole("timer").textContent).toBe("01:00");
  elapse(60);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Reverse crunch");
  expect(screen.getByText(/Round 2 of 3/)).toBeTruthy();
});

test("rep pace controls inside the timer switch between slow, normal, and fast and persist", () => {
  const { unmount } = mount();
  click("Start workout");
  advanceTo("Reverse crunch");
  const paceGroup = screen.getByRole("group", { name: "Rep pace" });
  expect(within(paceGroup).getByRole("button", { name: "Normal" }).getAttribute("aria-pressed")).toBe("true");
  expect(
    screen.getByRole("img", { name: "crunch movement illustration" }).style.getPropertyValue("--movement-duration"),
  ).toBe("3.5s");

  // Move to rep 2 at normal pace, then switch to Fast mid-set without losing the current rep or animation phase.
  elapse(4);
  expect(screen.getByRole("timer").textContent).toBe("2 / 15");
  fireEvent.click(within(paceGroup).getByRole("button", { name: "Fast" }));
  expect(within(paceGroup).getByRole("button", { name: "Fast" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("timer").textContent).toBe("2 / 15");
  const fastDiagram = screen.getByRole("img", { name: "crunch movement illustration" });
  expect(fastDiagram.style.getPropertyValue("--movement-duration")).toBe("2.63s");
  expect(fastDiagram.style.getPropertyValue("--movement-delay")).toMatch(/^-\d+(\.\d+)?s$/);

  // Switch to Slow and verify animation duration slows and preference persists across mounts.
  fireEvent.click(within(paceGroup).getByRole("button", { name: "Slow" }));
  expect(
    screen.getByRole("img", { name: "crunch movement illustration" }).style.getPropertyValue("--movement-duration"),
  ).toBe("4.55s");
  unmount();
  mount();
  click("Start workout");
  expect(
    within(screen.getByRole("group", { name: "Rep pace" }))
      .getByRole("button", { name: "Slow" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

test("Workout B finishes push-ups and both bridge legs in each secondary round", () => {
  mount(workouts[1]);
  click("Start workout");
  advanceTo("Push-up");
  expect(screen.getByText(/Pair 2 · Round 1 of 2/)).toBeTruthy();
  click("Set complete");
  expect(screen.getByRole("heading", { name: "Single-leg glute bridge" })).toBeTruthy();
  expect(screen.getByText(/Left leg/, { selector: ".focus-heading p" })).toBeTruthy();
  click("Set complete");
  expect(screen.getByText(/Right leg/, { selector: ".focus-heading p" })).toBeTruthy();
  click("Set complete");
  elapse(60);
  expect(screen.getByText(/Pair 2 · Round 2 of 2/)).toBeTruthy();
});

test("side plank holds automatically switch from left to right and then rest", () => {
  mount();
  click("Start workout");
  advanceTo("Side plank");
  expect(screen.getByText(/Left side/, { selector: ".focus-heading p" })).toBeTruthy();
  elapse(30);
  expect(screen.getByText(/Right side/, { selector: ".focus-heading p" })).toBeTruthy();
  expect(screen.getByRole("timer").textContent).toBe("00:30");
  elapse(30);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Take a breather");
});

test("the kettlebell checkbox replaces per-exercise variations, updates the session, and persists", () => {
  const { unmount } = mount();
  const checkbox = screen.getByRole<HTMLInputElement>("checkbox", { name: /Use 10 kg kettlebell/ });
  expect(checkbox.checked).toBe(false);

  click(/Self-resisted curl/);
  const bodyweightDialog = screen.getByRole("dialog", { name: "Self-resisted curl" });
  expect(within(bodyweightDialog).queryByRole("combobox", { name: "Exercise variation" })).toBeNull();
  fireEvent.click(within(bodyweightDialog).getByRole("button", { name: "Close" }));

  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
  expect(screen.getByRole("button", { name: /One-arm kettlebell curl/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /One-arm overhead press/ })).toBeTruthy();

  click(/One-arm kettlebell curl/);
  const detail = screen.getByRole("dialog", { name: "One-arm kettlebell curl" });
  expect(within(detail).queryByRole("combobox", { name: "Exercise variation" })).toBeNull();
  expect(within(detail).getByRole("img", { name: "curl movement illustration" })).toBeTruthy();
  expect(within(detail).getByText("6–12 reps per arm", { exact: true })).toBeTruthy();
  fireEvent.click(within(detail).getByRole("button", { name: "Close" }));

  unmount();
  mount();
  expect(screen.getByRole<HTMLInputElement>("checkbox", { name: /Use 10 kg kettlebell/ }).checked).toBe(true);
  expect(screen.getByRole("button", { name: /One-arm kettlebell curl/ })).toBeTruthy();
  click("Start workout");
  advanceTo("One-arm kettlebell curl");
  expect(screen.getByText(/Left arm · 6–12 reps/, { selector: ".focus-heading p" })).toBeTruthy();
  click("Set complete");
  expect(screen.getByText(/Right arm · 6–12 reps/, { selector: ".focus-heading p" })).toBeTruthy();
  click("Set complete");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Take a breather");
});

test("the guide shows selectable poses and pauses its own playback during a workout", () => {
  mount();
  click("Start workout");
  advanceTo("Pike push-up");
  click("Guide");
  const dialog = within(screen.getByRole("dialog", { name: "A note on form" }));
  const image = dialog.getByRole("img", { name: "pike pushup movement illustration" });
  const firstPose = image.querySelector(".figure")?.innerHTML;
  fireEvent.click(dialog.getByRole("button", { name: "Peak" }));
  expect(dialog.getByRole("button", { name: "Peak" }).getAttribute("aria-pressed")).toBe("true");
  expect(image.querySelector(".figure")?.innerHTML).not.toBe(firstPose);
  fireEvent.click(dialog.getByRole("button", { name: "Play demonstration" }));
  const runningFigure = image.querySelector(".figure");
  expect(runningFigure?.querySelector("style")?.textContent).toContain("@keyframes");
  fireEvent.click(dialog.getByRole("button", { name: "Pause demonstration" }));
  expect(image.classList.contains("is-still")).toBe(true);
  expect(image.querySelector(".figure")).toBe(runningFigure);
  fireEvent.click(dialog.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
});

test("pause, resume, mute, and restart confirmation work without losing progress", () => {
  const { props } = mount();
  click("Start workout");
  elapse(2);
  click("Mute sounds");
  expect(screen.getByRole("button", { name: "Enable sounds" }).getAttribute("aria-pressed")).toBe("false");
  click("Enable sounds");
  click("Pause");
  elapse(10);
  expect(screen.getByRole("timer").textContent).toBe("00:03");
  click("Resume workout");
  elapse(1);
  expect(screen.getByRole("timer").textContent).toBe("00:02");
  click("Restart");
  const dialog = screen.getByRole("dialog", { name: "Restart this workout?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("timer").textContent).toBe("00:02");
  click("Restart");
  click("Restart workout");
  expect(screen.getByRole("button", { name: "Start workout" })).toBeTruthy();
  expect(props.onFocusChange).toHaveBeenLastCalledWith(false);
});

test.each(workouts)("$name finishes with the actual time and its correct set count", (workout) => {
  const { props } = mount(workout);
  click("Start workout");
  elapse(1);
  click("Pause");
  advanceTo("Well done.");
  expect(screen.getByText("15", { exact: true })).toBeTruthy();
  expect(screen.getByText("3 + 2", { exact: true })).toBeTruthy();
  expect(screen.getByText("00:01", { exact: true })).toBeTruthy();
  expect(props.onComplete).toHaveBeenCalledOnce();
  click("Continue");
  expect(props.onBack).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Start workout" })).toBeTruthy();
});

test("hiding the player pauses it, and reopening preserves the exact step", () => {
  const { props, rerender } = mount();
  click("Start workout");
  advanceTo("Reverse crunch");
  elapse(4);
  expect(screen.getByRole("timer").textContent).toBe("2 / 15");
  rerender(<WorkoutPlayer {...props} visible={false} />);
  elapse(30);
  expect(screen.queryByRole("timer")).toBeNull();
  rerender(<WorkoutPlayer {...props} />);
  expect(screen.getByRole("timer").textContent).toBe("2 / 15");
  expect(screen.getByRole("button", { name: "Resume workout" })).toBeTruthy();
});

test("audio failure has a visible fallback while controls still work", () => {
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        throw new Error("Unavailable");
      }
    },
  );
  mount();
  click("Start workout");
  expect(screen.getByRole("status").textContent).toContain("Audio isn’t available");
  click("Skip countdown");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Warm up");
});
