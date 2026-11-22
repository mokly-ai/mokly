import assert from "node:assert/strict";
import test from "node:test";

import type { ModuleResolution } from "../packages/mokly/src/generated/sidecar/ModuleResolution.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import type { ReuseEvidence } from "../packages/mokly/src/generated/sidecar/ReuseEvidence.js";
import { EVIDENCE_LIMIT } from "../packages/mokly/src/sidecar/physical-input-reader.js";
import { PlanCandidates } from "../packages/mokly/src/sidecar/plan-candidates.js";

import { ReferencePlanCandidates } from "./helpers/reference_plan_candidates.js";

type Collector = PlanCandidates | ReferencePlanCandidates;
type Operation = (collector: Collector) => void;
type Random = (limit: number) => number;

const seeds = [0, 1, 42, 0x12345678, 0x9e3779b9, 0xdeadbeef];
const casesPerSeed = 12;
const roots = ["/r", "/r/", "/", "relative"];
const ordinaryNames = ["a", "b", "pkg", "x.js"];
const segments = [
  ...ordinaryNames,
  "A",
  "index",
  "y.mjs",
  "z.cjs",
  "w.jsx",
  "node_modules",
  ".pnp.cjs",
  "package.json",
  "\u212Aey",
  "\u0130",
  "é",
  "\ud800",
  'a"b',
  "a\u0001b",
  "a\\b",
  ".",
  "..",
  "",
];
const manifests = [
  '{"main":"./x.js","module":"./y.mjs"}',
  '{"browser":"./w.jsx","exports":{".":"./index.js"}}',
  '{"main":"./node_modules/pkg/z.cjs","exports":["./index.js",null]}',
];

function mulberry32(seed: number): Random {
  let state = seed;
  return (limit) => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 2 ** 32) * limit);
  };
}

function pick<T>(random: Random, values: readonly T[]): T {
  const value = values[random(values.length)];
  assert.ok(value !== undefined, "the generator needs a nonempty pool");
  return value;
}

function state(collector: Collector, context: string) {
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

type CollectorState = ReturnType<typeof state>;

function assertState(
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

function charge(apply: (operation: Operation) => void, bytes: number): void {
  const content = bytes - 3;
  // JSON escapes this control character as six bytes.
  const file =
    "\u0001".repeat(Math.floor(content / 6)) + "x".repeat(content % 6);
  apply((collector) => collector.selected(file));
}

function repeatNearLimit(
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

function randomCall(
  random: Random,
  paths: readonly string[],
  root: string,
  allowUnproved: boolean,
): Operation {
  const file = pick(random, paths);
  switch (random(12)) {
    case 0:
    case 1:
    case 2:
    case 3: {
      const base = file + pick(random, ["", "", "?raw", "#part"]);
      return (collector) => collector.candidate(base);
    }
    case 4:
    case 5:
      return (collector) => collector.path(file);
    case 6: {
      const target = pick(random, paths);
      return (collector) => collector.directory(file, target);
    }
    case 7: {
      const target = pick(random, paths);
      return (collector) => collector.link(file, target);
    }
    case 8: {
      const name = pick(random, ["pkg", "alias/x.js", "alias/pkg", "other"]);
      const mappings = {
        directory: root,
        targets: { pkg: ["./src/x.js"], "alias/*": ["./*", "./pkg/*"] },
      };
      const config = random(2) === 0 ? {} : { paths: mappings };
      return (collector) => collector.request(name, config);
    }
    case 9: {
      const bytes = Buffer.from(pick(random, manifests));
      return (collector) => collector.metadata(`${file}/package.json`, bytes);
    }
    case 10:
      return (collector) => collector.selected(file);
    default: {
      if (allowUnproved && random(2) === 0)
        return (collector) => collector.unproved();
      const imported = allowUnproved ? "pkg/*" : "pkg";
      return (collector) =>
        collector.metafile({
          inputs: {
            "entry.js": {
              bytes: 1,
              imports: [{ path: imported, kind: "import-statement" }],
            },
          },
          outputs: {},
        });
    }
  }
}

function directoryEvidence(
  random: Random,
  names: CollectorState["names"],
): ReuseEvidence {
  const directories = names.filter(() => random(2) === 0);
  const special = random(directories.length);
  const extra = pick(random, [
    [".PnP.cjs"],
    ["x.js", "X.js"],
    ["\u212Aey"],
    [],
  ]);
  const inputs: ReuseEvidence["inputs"] = {};
  for (const [index, { directory }] of directories.entries()) {
    const entries = ["plain.ts", "index.ts", "package.json"].filter(
      () => random(2) === 0,
    );
    if (index === special) entries.push(...extra);
    inputs[directory] = {
      kind: "directory",
      entries: entries.map((name) => ({ name, kind: "file", target: null })),
    };
  }
  return { complete: true, durable: true, inputs };
}

test(`plan candidate collection and attachment match the reference in ${seeds.length * casesPerSeed} seeded cases`, () => {
  for (const seed of seeds) {
    for (let caseNumber = 0; caseNumber < casesPerSeed; caseNumber++) {
      const context = `seed ${seed} case ${caseNumber}`;
      const random = mulberry32(seed ^ Math.imul(caseNumber, 0x9e3779b1));
      const root = pick(random, roots);
      const prefix = root.endsWith("/") ? root : `${root}/`;
      const settings: ModuleResolution = {
        aliases: {},
        conditions: [],
        loaders: {},
        mainFields: ["browser"],
        packageRoots: [],
        resolveExtensions:
          caseNumber % 2 === 0 ? [] : [".custom", ".js", "", ".mjs", ".é"],
      };
      const actual = new PlanCandidates(structuredClone(settings));
      const reference = new ReferencePlanCandidates(structuredClone(settings));
      const apply = (operation: Operation) => {
        operation(actual);
        operation(reference);
      };
      const calls = 50 + random(251);
      if (caseNumber < 2) {
        const base = prefix + pick(random, ordinaryNames);
        const repeat: Operation =
          caseNumber === 0
            ? (collector) => collector.path(base)
            : (collector) => collector.candidate(base);
        repeatNearLimit(random, apply, reference, repeat, base, calls, context);
      } else {
        if (caseNumber === 2 || caseNumber === 8)
          charge(apply, EVIDENCE_LIMIT - random(caseNumber === 2 ? 128 : 4097));
        const paths = segments.flatMap((segment) => [
          prefix + segment,
          `${prefix}${pick(random, ordinaryNames)}/${segment}/x.js`,
        ]);
        for (let index = 0; index < calls; index++) {
          const allowUnproved = caseNumber % 3 === 1 && index >= calls - 20;
          apply(randomCall(random, paths, root, allowUnproved));
        }
      }

      const before = state(reference, context);
      assertState(state(actual, context), before, `${context} before attach`);
      const evidence = directoryEvidence(random, before.names);
      const plan: ResolutionPlan = {
        paths: [`${prefix}entry.ts`, `${prefix}x.js`],
        imports: [[0, "./x.js", "import-statement", 1, true]],
      };
      const attach = (collector: Collector) => {
        const input = structuredClone(evidence);
        return JSON.stringify([
          collector.attach(structuredClone(plan), input),
          input,
        ]);
      };
      assert.equal(
        attach(actual),
        attach(reference),
        `${context} attached record`,
      );
      assertState(
        state(actual, context),
        state(reference, context),
        `${context} after attach`,
      );
    }
  }
});
