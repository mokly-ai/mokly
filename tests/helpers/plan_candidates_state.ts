import assert from "node:assert/strict";

import type { PlanCandidates } from "../../packages/mokly/src/sidecar/plan-candidates.js";

import type { ReferencePlanCandidates } from "./reference_plan_candidates.js";

export type Collector = PlanCandidates | ReferencePlanCandidates;
export type Operation = (collector: Collector) => void;
export type Random = (limit: number) => number;

export function mulberry32(seed: number): Random {
  let state = seed;
  return (limit) => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 2 ** 32) * limit);
  };
}

export function pick<T>(random: Random, values: readonly T[]): T {
  const value = values[random(values.length)];
  assert.ok(value !== undefined, "the generator needs a nonempty pool");
  return value;
}

export function state(collector: Collector, context: string) {
  const names: unknown = Reflect.get(collector, "names");
  const redirects: unknown = Reflect.get(collector, "redirects");
  const blocked: unknown = Reflect.get(collector, "blocked");
  const selectedTargets: unknown = Reflect.get(collector, "selectedTargets");
  const bytes: unknown = Reflect.get(collector, "bytes");
  const overflow: unknown = Reflect.get(collector, "overflow");
  const proved: unknown = Reflect.get(collector, "proved");
  assert.ok(names instanceof Map, `${context} names`);
  assert.ok(redirects instanceof Map, `${context} redirects`);
  assert.ok(blocked instanceof Set, `${context} blocked`);
  assert.ok(selectedTargets instanceof Set, `${context} selectedTargets`);
  assert.ok(typeof bytes === "number", `${context} bytes`);
  assert.ok(typeof overflow === "boolean", `${context} overflow`);
  assert.ok(typeof proved === "boolean", `${context} proved`);

  const directories: ReadonlyMap<unknown, unknown> = names;
  return {
    names: Array.from(directories, ([directory, members]) => {
      assert.ok(
        typeof directory === "string" && members instanceof Set,
        `${context} names`,
      );
      return { directory, members: Array.from<unknown>(members) };
    }),
    redirects: Array.from<[unknown, unknown]>(redirects),
    blocked: Array.from<unknown>(blocked),
    selectedTargets: Array.from<unknown>(selectedTargets),
    bytes,
    overflow,
    proved,
  };
}

export type CollectorState = ReturnType<typeof state>;

export function assertState(
  actual: CollectorState,
  expected: CollectorState,
  context: string,
): void {
  const fields: ReadonlyArray<keyof CollectorState> = [
    "names",
    "redirects",
    "blocked",
    "selectedTargets",
    "bytes",
    "overflow",
    "proved",
  ];
  for (const field of fields)
    assert.deepEqual(actual[field], expected[field], `${context} ${field}`);
}

export function charge(
  apply: (operation: Operation) => void,
  bytes: number,
): void {
  const content = bytes - 3;
  // JSON escapes this control character as six bytes.
  const file =
    "\u0001".repeat(Math.floor(content / 6)) + "x".repeat(content % 6);
  apply((collector) => collector.selected(file));
}
