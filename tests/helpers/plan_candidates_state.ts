import assert from "node:assert/strict";

import type { ModuleResolution } from "../../packages/mokly/src/generated/sidecar/ModuleResolution.js";
import { EVIDENCE_LIMIT } from "../../packages/mokly/src/sidecar/physical-input-reader.js";
import { PlanCandidates } from "../../packages/mokly/src/sidecar/plan-candidates.js";

import { ReferencePlanCandidates } from "./reference_plan_candidates.js";

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

export function repeatNearLimit(
  random: Random,
  apply: (operation: Operation) => void,
  reference: ReferencePlanCandidates,
  repeat: Operation,
  base: string,
  calls: number,
  context: string,
): void {
  apply(repeat);
  for (let index = 1; index < calls - 2; index++) {
    const selected = `${base}/${random(8)}.ts`;
    apply(
      random(3) === 0 ? (collector) => collector.selected(selected) : repeat,
    );
  }
  // Leave too little room for the repeated name, with no later call to mask overflow.
  charge(apply, EVIDENCE_LIMIT - state(reference, context).bytes - random(4));
  apply(repeat);
}

export function stepDownRoom(
  random: Random,
  apply: (operation: Operation) => void,
  actual: PlanCandidates,
  reference: ReferencePlanCandidates,
  repeat: Operation,
  context: string,
): void {
  apply(repeat);
  const room = 1_200 + random(849);
  charge(apply, EVIDENCE_LIMIT - state(reference, context).bytes - room);
  for (let step = 0; step < room; step++) {
    apply(repeat);
    const repeatContext = `${context} repeat ${step}`;
    const expected = state(reference, repeatContext);
    const remaining = EVIDENCE_LIMIT - expected.bytes;
    assertState(
      state(actual, repeatContext),
      expected,
      `${repeatContext} room ${remaining}`,
    );
    if (expected.overflow) return;
    apply((collector) => collector.selected(`selected-${step}`));
  }
}

interface RepeatInput {
  directory: string;
  basename: string;
  extensions: string[];
}

export function repeatInputs(random: Random): RepeatInput[] {
  const characters = ["p", '"', "\u0001"];
  const long = 64 + random(33);
  const run = () =>
    pick(random, characters).repeat(random(2) === 0 ? 1 + random(4) : long);
  return [
    { directory: "p".repeat(long), basename: "a", extensions: [".js"] },
    { directory: "r", basename: "\u0001".repeat(long), extensions: [".js"] },
    {
      directory: "r",
      basename: "a",
      extensions: [".js", `.${pick(random, characters).repeat(long)}`],
    },
    ...Array.from({ length: 11 }, () => ({
      directory: run(),
      basename: run(),
      extensions: [".js", `.${run()}`],
    })),
  ];
}

function repeatWithRoom(
  collector: Collector,
  repeat: Operation,
  room: number,
  context: string,
): CollectorState {
  repeat(collector);
  // Set room after setup to avoid scanning a large selected target for each probe.
  assert.ok(
    Reflect.set(collector, "bytes", EVIDENCE_LIMIT - room),
    `${context} set room ${room}`,
  );
  repeat(collector);
  return state(collector, context);
}

function lastOverflowRoom(
  settings: ModuleResolution,
  repeat: Operation,
  context: string,
): number {
  const setup = new ReferencePlanCandidates(settings);
  repeat(setup);
  let fittingRoom = EVIDENCE_LIMIT - state(setup, context).bytes;
  let overflowingRoom = 0;
  const overflows = (room: number) =>
    repeatWithRoom(new ReferencePlanCandidates(settings), repeat, room, context)
      .overflow;
  assert.equal(overflows(fittingRoom), false, `${context} room ${fittingRoom}`);
  assert.equal(overflows(overflowingRoom), true, `${context} room 0`);
  while (fittingRoom - overflowingRoom > 1) {
    const room = Math.floor((fittingRoom + overflowingRoom) / 2);
    if (overflows(room)) overflowingRoom = room;
    else fittingRoom = room;
  }
  return overflowingRoom;
}

export function assertRepeatBoundary(
  extensions: string[],
  repeat: Operation,
  context: string,
): void {
  const settings: ModuleResolution = {
    aliases: {},
    conditions: [],
    loaders: {},
    mainFields: [],
    packageRoots: [],
    resolveExtensions: extensions,
  };
  const overflowRoom = lastOverflowRoom(settings, repeat, context);
  for (const room of [overflowRoom, overflowRoom + 1]) {
    const label = `${context} room ${room}`;
    const actual = new PlanCandidates(structuredClone(settings));
    const reference = new ReferencePlanCandidates(settings);
    assertState(
      repeatWithRoom(actual, repeat, room, label),
      repeatWithRoom(reference, repeat, room, label),
      label,
    );
  }
}
