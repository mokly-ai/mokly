import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";

import {
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";
import { planCapture } from "./helpers/plan_capture.js";

test("unused folder exports keep selectors and matched prefixes retain whole comparisons with exact-key priority", async (context) => {
  for (const [name, exports, specifier, narrowed] of [
    [
      "unused identity",
      { ".": "./value.js", "./unused/": "./unused/" },
      "chosen",
      true,
    ],
    [
      "unused nonidentity",
      { ".": "./value.js", "./unused/": "./other/" },
      "chosen",
      true,
    ],
    ["matched prefix", { "./": "./" }, "chosen/value.js", false],
    [
      "exact key",
      { "./": "./", "./types": "./value.js" },
      "chosen/types",
      true,
    ],
  ] as const) {
    const root = await nativeRoot(context);
    await write(
      path.join(root, "entry.mjs"),
      `export {value} from ${JSON.stringify(specifier)};`,
    );
    await write(
      path.join(root, "node_modules/chosen/package.json"),
      JSON.stringify({ name: "chosen", exports }),
    );
    await write(
      path.join(root, "node_modules/chosen/value.js"),
      "export const value=1;",
    );
    const captured = await bundle(
      nativeParams(root),
      build,
      undefined,
      planCapture(root),
    );
    const plan = captured.result.plan;
    assert.ok(plan, name);
    assert.equal(Boolean(plan.candidates?.length), narrowed, name);
    assert.equal(captured.result.compiled.reuseEvidence.complete, true, name);
    assert.equal(captured.result.compiled.reuseEvidence.durable, true, name);
  }
});

test("encoded bare requests retain whole comparisons after export substitution", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "chosen/%76alue";',
  );
  await write(
    path.join(root, "node_modules/chosen/package.json"),
    '{"name":"chosen","exports":{"./*":"./lib/*.js"}}',
  );
  await write(
    path.join(root, "node_modules/chosen/lib/value.js"),
    "export const value=1;",
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
  assert.equal(captured.result.compiled.reuseEvidence.durable, true);
});
