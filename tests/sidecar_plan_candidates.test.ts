import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { PlanCandidates } from "../packages/mokly/src/sidecar/plan-candidates.js";

import {
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { planCapture } from "./helpers/plan_capture.js";

test("a captured plan indexes fixed names, independent rewrites, and relative main targets", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "./value.js"; export {main} from "./folder";',
  );
  await write(path.join(root, "value.ts"), "export const value=1;");
  await write(
    path.join(root, "folder/package.json"),
    '{"main":"./src/entry.js"}',
  );
  await write(path.join(root, "folder/src/entry.ts"), "export const main=2;");
  const captured = await bundle(
    nativeParams(
      root,
      {},
      {
        resolveExtensions: [".custom", ".js"],
      },
    ),
    build,
    undefined,
    planCapture(root),
  );
  const plan = captured.result.plan;
  assert.ok(plan?.candidates);
  const names = new Map(
    plan.candidates.map(([index, names]) => [plan.paths[index], names]),
  );
  const rootNames = names.get(root);
  assert.ok(rootNames);
  for (const name of [
    "value.js",
    "value.js.custom",
    "value.js.js",
    "value.ts",
    "value.tsx",
    "node_modules",
    "package.json",
    "tsconfig.json",
    "jsconfig.json",
    ".pnp.data.json",
    ".pnp.cjs",
    ".pnp.js",
  ])
    assert.ok(rootNames.includes(name), name);
  assert.ok(names.get(path.join(root, "folder"))?.includes("src"));
  for (const [directory] of names)
    assert.equal(
      captured.result.compiled.reuseEvidence.inputs[directory!]!.kind,
      "directory",
    );
});

test("captured non-ASCII members retain whole directory comparisons", async (context) => {
  for (const members of [["İ.ts"], ["\u212Aey.ts"]]) {
    const root = await nativeRoot(context);
    await write(path.join(root, "entry.mjs"), 'export {value} from "./value";');
    await write(path.join(root, "value.js"), "export const value=1;");
    for (const member of members)
      await write(path.join(root, member), "export const other=1;");
    const captured = await bundle(
      nativeParams(root),
      build,
      undefined,
      planCapture(root),
    );
    assert.ok(captured.result.plan);
    const plan = captured.result.plan;
    assert.equal(
      plan.candidates?.some(([index]) => plan.paths[index] === root) ?? false,
      false,
      members.join(","),
    );
  }
});

test("literal folded collisions retain whole comparisons while a single spelling keeps selectors", () => {
  const root = path.resolve("fixture");
  for (const [members, narrowed] of [
    [["other.ts", "OTHER.ts"], false],
    [["other.ts"], true],
  ] as const) {
    const candidates = new PlanCandidates(nativeParams(root).moduleResolution);
    candidates.candidate(path.join(root, "value"));
    const plan = candidates.attach(
      { paths: [], imports: [] },
      {
        complete: true,
        durable: true,
        inputs: {
          [root]: {
            kind: "directory",
            entries: members.map((name) => ({
              name,
              kind: "file",
              target: null,
            })),
          },
        },
      },
    );
    assert.ok(plan);
    assert.equal(
      plan.candidates?.some(([index]) => plan.paths[index] === root) ?? false,
      narrowed,
      members.join(","),
    );
  }
});

test("a native selected target omitted from candidate names retains its canonical directory comparison", () => {
  const root = path.resolve("fixture");
  const alias = path.join(root, "alias");
  const canonical = path.join(root, "canonical");
  for (const [target, narrowed] of [
    ["value.ts", true],
    ["unindexed.ts", false],
  ] as const) {
    const candidates = new PlanCandidates(nativeParams(root).moduleResolution);
    candidates.candidate(path.join(alias, "value"));
    candidates.directory(alias, canonical);
    candidates.selected(path.join(alias, target));
    const plan = candidates.attach(
      { paths: [], imports: [] },
      {
        complete: true,
        durable: true,
        inputs: {
          [canonical]: {
            kind: "directory",
            entries: [
              { name: "value.ts", kind: "file", target: null },
              { name: "unindexed.ts", kind: "file", target: null },
            ],
          },
        },
      },
    );
    assert.ok(plan);
    assert.equal(
      plan.candidates?.some(([index]) => plan.paths[index] === canonical) ??
        false,
      narrowed,
      target,
    );
  }
});

test("a zero-match glob retains whole directory comparisons", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export const run=(name)=>import("./empty/"+name+".js");',
  );
  await write(path.join(root, "empty/.keep"), "");
  const captured = await bundle(
    nativeParams(root),
    build,
    undefined,
    planCapture(root),
  );
  assert.ok(captured.result.plan);
  assert.equal(captured.result.plan.candidates, undefined);
});

test("matching absolute paths mappings keep whole comparisons when target provenance is unproved", async (context) => {
  const root = await nativeRoot(context);
  const absolute = path.join(root, "written.js");
  await write(
    path.join(root, "entry.mjs"),
    `export {value} from ${JSON.stringify(absolute)};`,
  );
  await write(path.join(root, "two/value.js"), "export const value=1;");
  await write(path.join(root, "one/.keep"), "");
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        paths: { [absolute]: ["./one/value.js", "./two/value.js"] },
      },
    }),
  );
  const captured = await bundle(
    nativeParams(root),
    build,
    undefined,
    planCapture(root),
  );
  assert.ok(captured.result.plan);
  assert.equal(captured.result.plan.candidates, undefined);
  assert.equal(captured.result.compiled.reuseEvidence.complete, true);
  assert.ok(
    captured.result.modules.some((module) => module.path === "two/value.js"),
  );
});

test("candidate retention overflow drops only the optional plan", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "./value.js";',
  );
  await write(path.join(root, "value.js"), "export const value=1;");
  const captured = await bundle(
    nativeParams(
      root,
      {},
      {
        resolveExtensions: ["." + "x".repeat(8 * 1024 * 1024)],
      },
    ),
    build,
    undefined,
    planCapture(root),
  );
  assert.equal(captured.result.plan, undefined);
  assert.equal(captured.result.compiled.reuseEvidence.complete, true);
  assert.equal(captured.result.compiled.reuseEvidence.durable, true);
  assert.deepEqual(
    captured.result.modules.map((module) => module.path),
    ["entry.mjs", "value.js"],
  );
});
