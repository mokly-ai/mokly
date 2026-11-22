import assert from "node:assert/strict";
import test from "node:test";

import type { ModuleResolution } from "../packages/mokly/src/generated/sidecar/ModuleResolution.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import type { ReuseEvidence } from "../packages/mokly/src/generated/sidecar/ReuseEvidence.js";
import { EVIDENCE_LIMIT } from "../packages/mokly/src/sidecar/physical-input-reader.js";
import { PlanCandidates } from "../packages/mokly/src/sidecar/plan-candidates.js";

import {
  assertRepeatBoundary,
  assertState,
  charge,
  mulberry32,
  pick,
  repeatInputs,
  repeatNearLimit,
  state,
  stepDownRoom,
  type Collector,
  type CollectorState,
  type Operation,
  type Random,
} from "./helpers/plan_candidates_state.js";
import { ReferencePlanCandidates } from "./helpers/reference_plan_candidates.js";

const seeds = [0, 1, 42, 0x12345678, 0x9e3779b9, 0xdeadbeef];
const regularCasesPerSeed = 12;
const casesPerSeed = regularCasesPerSeed + 2;
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
      const stepsThroughRoom = caseNumber >= regularCasesPerSeed;
      const settings: ModuleResolution = {
        aliases: {},
        conditions: [],
        loaders: {},
        mainFields: ["browser"],
        packageRoots: [],
        resolveExtensions: stepsThroughRoom
          ? [".ts", ".js", `.${"x".repeat(768 + random(32))}`]
          : caseNumber % 2 === 0
            ? []
            : [".custom", ".js", "", ".mjs", ".é"],
      };
      const actual = new PlanCandidates(structuredClone(settings));
      const reference = new ReferencePlanCandidates(structuredClone(settings));
      const apply = (operation: Operation) => {
        operation(actual);
        operation(reference);
      };
      const calls = 50 + random(251);
      if (caseNumber < 2 || stepsThroughRoom) {
        let directory = prefix;
        if (stepsThroughRoom) {
          const parent = "p".repeat(40 + random(12));
          const child = "q".repeat(40 + random(12));
          directory += `${parent}/${child}/`;
        }
        const base = directory + pick(random, ordinaryNames);
        const repeat: Operation =
          caseNumber % 2 === 0
            ? (collector) => collector.path(base)
            : (collector) => collector.candidate(base);
        if (stepsThroughRoom)
          stepDownRoom(random, apply, actual, reference, repeat, context);
        else
          repeatNearLimit(
            random,
            apply,
            reference,
            repeat,
            base,
            calls,
            context,
          );
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
      const room = EVIDENCE_LIMIT - before.bytes;
      assertState(
        state(actual, context),
        before,
        `${context} before attach room ${room}`,
      );
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

test("plan candidate repeats match the reference on both sides of the overflow boundary", () => {
  const methods: ReadonlyArray<"path" | "candidate"> = ["path", "candidate"];
  for (const seed of seeds) {
    const inputs = repeatInputs(mulberry32(seed));
    for (const [
      index,
      { directory, basename, extensions },
    ] of inputs.entries()) {
      const base = `${directory}/${basename}`;
      for (const method of methods) {
        assertRepeatBoundary(
          extensions,
          (collector) => collector[method](base),
          `seed ${seed} shape ${index} ${method}`,
        );
      }
    }
  }
});
