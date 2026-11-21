import { render, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import MovementDiagram from "./MovementDiagram";
import type { Movement } from "./workouts";

test.each<Movement>([
  "squat",
  "march",
  "circles",
  "pushup",
  "pike-pushup",
  "lunge",
  "goblet-lunge",
  "press",
  "crunch",
  "row",
  "prone-w",
  "bridge",
  "curl",
  "self-resisted-curl",
  "plank",
  "rest",
])("renders a valid accessible %s guide", (movement) => {
  const { rerender } = render(<MovementDiagram movement={movement} />);
  const illustration = screen.getByRole("img", {
    name: `${movement.replaceAll("-", " ")} movement illustration`,
  });
  expect(illustration.querySelector("path")).toBeTruthy();
  expect(illustration.outerHTML).not.toMatch(/NaN|Infinity|undefined/);
  rerender(<MovementDiagram movement={movement} playing={false} />);
  expect(illustration.classList.contains("is-still")).toBe(true);
});

test("one articulated figure moves continuously while the side plank stays still", () => {
  const { container, rerender } = render(<MovementDiagram movement="plank" />);
  expect(container.querySelectorAll(".figure")).toHaveLength(1);
  expect(container.querySelector("style")).toBeNull();
  rerender(<MovementDiagram movement="curl" />);
  expect(container.querySelectorAll(".figure")).toHaveLength(1);
  expect(container.querySelector("style")?.textContent).toContain("@keyframes");
  expect(container.querySelectorAll(".movement-frame")).toHaveLength(0);
  rerender(<MovementDiagram movement="circles" />);
  expect(container.querySelectorAll(".figure")).toHaveLength(1);
  expect(container.querySelector("style")?.textContent).toContain("@keyframes");
});

test("pausing and resuming preserve the figure and its animation timelines", () => {
  const { container, rerender } = render(<MovementDiagram movement="curl" />);
  const figure = container.querySelector(".figure");
  const timelines = [...container.querySelectorAll("style")].map((style) => style.textContent);
  rerender(<MovementDiagram movement="curl" playing={false} />);
  expect(container.querySelector(".figure")).toBe(figure);
  expect(container.querySelector(".movement.is-still")).toBeTruthy();
  expect([...container.querySelectorAll("style")].map((style) => style.textContent)).toEqual(timelines);
  rerender(<MovementDiagram movement="curl" />);
  expect(container.querySelector(".figure")).toBe(figure);
  expect(container.querySelector(".is-still")).toBeNull();
});

test("right-side steps mirror the diagram and describe the active side", () => {
  const { container } = render(<MovementDiagram movement="row" side="Right" />);
  expect(container.querySelector(".movement-scene")?.getAttribute("transform")).toBe("translate(260 0) scale(-1 1)");
  expect(container.querySelector("desc")?.textContent).toContain("Right side.");
  expect(container.querySelector(".figure-bench")).toBeTruthy();
});

test("static review poses render without an animation loop", () => {
  const { container } = render(<MovementDiagram movement="press" phase={2} />);
  expect(container.querySelectorAll(".figure")).toHaveLength(1);
  expect(container.querySelector("style")).toBeNull();
});

test("every exercise renders consistent hair, front views avoid dimming limbs, and durations match real-time tempo", () => {
  for (const movement of ["crunch", "bridge", "pushup", "curl", "press", "plank"] as const) {
    const { container, unmount } = render(<MovementDiagram movement={movement} phase={0} />);
    expect(container.querySelector(".figure-hair")).toBeTruthy();
    if (movement === "crunch" || movement === "bridge") {
      expect(container.querySelector(".figure-head")?.getAttribute("transform")).toBe("scale(-1 1)");
    }
    if (movement === "press" || movement === "plank") {
      expect(container.querySelectorAll(".figure-far")).toHaveLength(0);
    }
    unmount();
  }

  const { container: overhead } = render(<MovementDiagram movement="prone-w" phase={0} />);
  expect(overhead.querySelector(".figure-scalp")).toBeTruthy();
  expect(overhead.querySelectorAll(".figure-far")).toHaveLength(0);

  const { container: circles } = render(<MovementDiagram movement="circles" />);
  expect(circles.querySelector("svg")?.style.getPropertyValue("--movement-duration")).toBe("1.5s");
  const { container: pushup } = render(<MovementDiagram movement="pushup" />);
  expect(pushup.querySelector("svg")?.style.getPropertyValue("--movement-duration")).toBe("3.2s");
});
