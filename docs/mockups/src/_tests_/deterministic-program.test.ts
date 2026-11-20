import assert from "node:assert/strict";
import test from "node:test";

import { createDrawingsProgram } from "./deterministic-source-parser";
import { deterministicSourceViolations } from "./deterministic-source-policy";

const prefix = "docs/mockups/src/fixtures/";

for (const extension of ["js", "jsx", "mjs"])
  test("JavaScript JSX keeps the JSDoc Date type: " + extension, () => {
    const drawing = {
      path: prefix + "policy-jsdoc." + extension,
      text: "/** @param {Date} date */ export function render(date) { return <p>{String(date)}</p>; }",
    };
    assert.ok(
      deterministicSourceViolations(drawing).some((problem) =>
        problem.includes("Date string conversion"),
      ),
    );
  });

for (const extension of ["js", "jsx", "mjs"])
  test("JavaScript JSX keeps safe number formatting: " + extension, () => {
    const drawing = {
      path: prefix + "policy-number." + extension,
      text: '/** @param {number} count */ export function render(count) { return <p>{count.toLocaleString("en-US")}</p>; }',
    };
    assert.deepEqual(deterministicSourceViolations(drawing), []);
  });

test("the policy follows imported Date and number values through the drawings program", () => {
  const values = {
    path: prefix + "policy-values.ts",
    text: 'export const recorded = new Date("2026-10-12T09:30:00Z"); export const count = 42;',
  };
  const drawing = {
    path: prefix + "policy-drawing.tsx",
    text: 'import { recorded, count } from "./policy-values"; String(recorded); count.toLocaleString("en-US");',
  };
  const program = createDrawingsProgram([values, drawing]);
  const problems = deterministicSourceViolations(drawing, program);
  assert.ok(
    problems.some((problem) => problem.includes("Date string conversion")),
  );
  assert.equal(
    problems.some((problem) => problem.includes("timeZone")),
    false,
  );
});

test("an imported constant date string passes without executing its module", () => {
  const values = {
    path: prefix + "policy-stamp.ts",
    text: 'export const stamp = "2026-10-12T09:30:00Z";',
  };
  const drawing = {
    path: prefix + "policy-consumer.tsx",
    text: 'import { stamp } from "./policy-stamp"; new Date(stamp); Date.parse(stamp);',
  };
  const program = createDrawingsProgram([values, drawing]);
  assert.deepEqual(deterministicSourceViolations(drawing, program), []);
});
