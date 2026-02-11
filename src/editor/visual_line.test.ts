import { describe, expect, it } from "vitest";
import { findVisualLineTarget, type CaretMeasure } from "./visual_line";

function buildMeasureMap(rows: number[][]): CaretMeasure[] {
  const out: CaretMeasure[] = [];
  for (let r = 0; r < rows.length; r += 1) {
    const lefts = rows[r];
    for (const left of lefts) {
      out.push({ top: r * 20, left });
    }
  }
  return out;
}

describe("findVisualLineTarget", () => {
  it("moves to nearest x position on next visual line", () => {
    const points = buildMeasureMap([
      [0, 10, 20, 30, 40], // indices 0..4
      [0, 10, 20, 30],     // indices 5..8
      [0, 10, 20, 30],     // indices 9..12
    ]);
    const textLength = points.length - 1;
    const current = 3; // top row, x=30

    const target = findVisualLineTarget(
      current,
      textLength,
      1,
      points[current],
      (cursor) => points[cursor],
    );

    expect(target).toBe(8);
  });

  it("moves to nearest x position on previous visual line", () => {
    const points = buildMeasureMap([
      [0, 10, 20, 30, 40],
      [0, 10, 20, 30],
      [0, 10, 20, 30],
    ]);
    const textLength = points.length - 1;
    const current = 10; // third row, x=10

    const target = findVisualLineTarget(
      current,
      textLength,
      -1,
      points[current],
      (cursor) => points[cursor],
    );

    expect(target).toBe(6);
  });

  it("clamps at document end when no next visual line exists", () => {
    const points = buildMeasureMap([
      [0, 10, 20],
      [0, 10],
    ]);
    const textLength = points.length - 1;
    const current = textLength;

    const target = findVisualLineTarget(
      current,
      textLength,
      1,
      points[current],
      (cursor) => points[cursor],
    );

    expect(target).toBe(textLength);
  });
});
