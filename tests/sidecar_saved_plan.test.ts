import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { planKey } from "../packages/mokly/src/sidecar/native-resolution.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import {
  countedCompile,
  fingerprint,
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { planCapture } from "./helpers/plan_capture.js";

/** Edit identities include a random runtime key, unlike captured identities. */
function editFingerprint(result: BundleResult) {
  return fingerprint({
    ...result,
    compiled: { ...result.compiled, identity: "fresh edit identity" },
  });
}

for (const exact of [true, false])
  test(`a captured native plan shares its bundle call's durable evidence with exact=${exact}`, async (context) => {
    const root = await nativeRoot(context);
    await write(
      path.join(root, "entry.mjs"),
      'export {value} from "./value.js";',
    );
    await write(path.join(root, "value.js"), 'export const value="original";');
    if (!exact)
      await write(
        path.join(root, "tsconfig.json"),
        '{"compilerOptions":{"strict":true}}',
      );
    const counted = countedCompile();
    const captured = await bundle(
      nativeParams(root),
      counted.compile,
      undefined,
      planCapture(root),
    );
    const { reuseEvidence } = captured.result.compiled;
    assert.ok(
      captured.result.plan,
      `the captured bundle must return its native plan: ${JSON.stringify({
        complete: reuseEvidence.complete,
        durable: reuseEvidence.durable,
        uncaptured: reuseEvidence.uncaptured ?? null,
        toolchainPresent: Boolean(captured.result.compiled.toolchain),
      })}`,
    );
    assert.deepEqual(captured.result.plan.imports, {
      [planKey(
        path.join(root, "mokly-entry"),
        path.join(root, "entry.mjs"),
        "import-statement",
      )]: {
        path: path.join(root, "entry.mjs"),
        sideEffects: true,
      },
      [planKey(path.join(root, "entry.mjs"), "./value.js", "import-statement")]:
        {
          path: path.join(root, "value.js"),
          sideEffects: true,
        },
    });
    assert.equal(captured.result.compiled.reuseEvidence.complete, true);
    assert.equal(captured.result.compiled.reuseEvidence.durable, true);
    assert.equal(counted.counts.compilations, exact ? 1 : 2);
  });

test("an edit plan makes one attempt and matches native-first output and inputs for uncovered imports", async (context) => {
  const root = await nativeRoot(context);
  const entry = path.join(root, "entry.mjs");
  const target = path.join(root, "value.js");
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"strict":true}}',
  );
  await write(entry, 'export {value} from "./value.js";');
  await write(target, 'export const value="original";');
  await write(
    path.join(root, "existing.js"),
    'export const existing="existing";',
  );
  const params = nativeParams(root);
  const plan = {
    imports: {
      [planKey(entry, "./value.js", "import-statement")]: {
        path: target,
        sideEffects: true,
      },
    },
  };
  for (const [name, source] of [
    ["content", 'export const value="edited";'],
    [
      "existing import",
      'export {value} from "./value.js"; export {existing} from "./existing.js";',
    ],
    [
      "new module",
      'export {value} from "./value.js"; export {added} from "./added.js";',
    ],
  ] as const) {
    if (name === "content") await write(target, source);
    else await write(entry, source);
    if (name === "new module")
      await write(path.join(root, "added.js"), 'export const added="new";');
    const counted = countedCompile();
    const planned = await bundle(
      params,
      counted.compile,
      undefined,
      undefined,
      "serveEdit",
      plan,
    );
    const native = await bundle(
      params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.equal(counted.counts.compilations, 1, name);
    assert.deepEqual(
      editFingerprint(planned.result),
      editFingerprint(native.result),
      name,
    );
    assert.equal(planned.result.plan, undefined);
    assert.deepEqual(planned.result.compiled.reuseEvidence, {
      complete: false,
      durable: false,
      inputs: {},
      uncaptured: "serveEdit",
    });
  }
});

test("a direct planned error equals native-first and never retries", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {missing} from "./value.js";',
  );
  await write(path.join(root, "value.js"), "export const present=1;");
  const params = nativeParams(root);
  const plan = {
    imports: {
      [planKey(path.join(root, "entry.mjs"), "./value.js", "import-statement")]:
        {
          path: path.join(root, "value.js"),
          sideEffects: true,
        },
    },
  };
  const counted = countedCompile();
  const error = (operation: Promise<unknown>) =>
    operation.then(
      () => assert.fail("the missing export must fail"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return error.message;
      },
    );
  const planned = await error(
    bundle(params, counted.compile, undefined, undefined, "serveEdit", plan),
  );
  const native = await error(
    bundle(params, build, undefined, undefined, "serveEdit"),
  );
  assert.equal(planned, native);
  assert.match(planned, /No matching export/);
  assert.equal(counted.counts.compilations, 1);
});

test("a request plan stays outside settings and a full request ignores it", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "./value.js";',
  );
  await write(path.join(root, "value.js"), "export const value=1;");
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"strict":true}}',
  );
  const counted = countedCompile();
  const session = new Session("test", () => {}, counted.compile);
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  const params = { ...nativeParams(root), capture: "serveEdit" as const };
  const first = await session.call({
    id: 1,
    method: "bundle",
    params: { ...params, plan: { imports: {} } },
  });
  const second = await session.call({
    id: 2,
    method: "bundle",
    params: {
      ...params,
      plan: {
        imports: {
          unused: { path: "different request-only plan", sideEffects: true },
        },
      },
    },
  });
  assert.ok(first && typeof first === "object" && "generation" in first);
  assert.ok(second && typeof second === "object" && "generation" in second);
  assert.equal(second.generation, first.generation);
  assert.equal(
    counted.counts.compilations,
    1,
    "different request plans keep live reuse",
  );
  await session.call({
    id: 3,
    method: "bundle",
    params: { ...nativeParams(root), plan: { imports: {} } },
  });
  assert.equal(
    counted.counts.compilations,
    3,
    "full capture keeps native-first",
  );
});
