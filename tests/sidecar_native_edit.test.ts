import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { nativeResolveFilter } from "../packages/mokly/src/sidecar/native-resolution.js";

import {
  countedCompile,
  editFingerprint,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";
import { planCapture } from "./helpers/plan_capture.js";

test("an uncaptured native require.resolve keeps its fresh plan for one complete planned attempt", async (context) => {
  const root = await nativeRoot(context);
  await packageAt(
    path.join(root, "node_modules/lib"),
    "lib",
    'export { value } from "./part.mjs"; export const file = require.resolve("./part.mjs");',
  );
  await write(
    path.join(root, "node_modules/lib/part.mjs"),
    "export const value = 1;",
  );
  await write(
    path.join(root, "entry.mjs"),
    'export { value, file } from "lib";',
  );
  const params = nativeParams(root);
  const capturedCount = countedCompile();
  const captured = await bundle(
    params,
    capturedCount.compile,
    undefined,
    planCapture(root),
  );
  const { metadataIdentity, ...capturedCompiled } = captured.result.compiled;
  assert.equal(typeof metadataIdentity, "string");
  assert.ok(captured.result.plan);
  assert.equal(captured.result.compiled.reuseEvidence.complete, true);
  assert.equal(captured.result.compiled.reuseEvidence.durable, true);
  assert.equal(capturedCount.counts.compilations, 1);
  assert.equal(capturedCount.consumerResolves(), 2);
  const counted = countedCompile();
  const edited = await bundle(
    params,
    counted.compile,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.equal(edited.result.compiled.metadataIdentity, undefined);
  assert.deepEqual(
    editFingerprint(edited.result),
    editFingerprint({
      ...captured.result,
      compiled: {
        ...capturedCompiled,
        reuseEvidence: {
          complete: false,
          durable: false,
          inputs: {},
          uncaptured: "serveEdit",
        },
      },
    }),
  );
  assert.equal(edited.result.plan, undefined);
  assert.equal(counted.counts.compilations, 2);
  assert.equal(counted.consumerResolves(), 3);
});

test("the native filter skips only relative strings at the Go callback boundary", async () => {
  const relative = [
    ".",
    "..",
    "./value",
    "../value",
    ".\\value",
    "..\\value",
    "./雪😀",
  ];
  const handled = [
    "",
    ".value",
    "..value",
    "...",
    "lib",
    "/value",
    "C:\\value",
    "node:path",
    "#value",
    "\n",
  ];
  const callbacks: string[] = [];
  await build({
    stdin: {
      contents: [...relative, ...handled]
        .map((name) => `import ${JSON.stringify(name)};`)
        .join("\n"),
    },
    bundle: true,
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "native-filter",
        setup(builder) {
          builder.onResolve({ filter: nativeResolveFilter }, (args) => {
            callbacks.push(args.path);
            return { path: args.path || "empty", external: true };
          });
          builder.onResolve({ filter: /.*/ }, (args) => ({
            path: args.path || "empty",
            external: true,
          }));
        },
      },
    ],
  });
  assert.deepEqual(callbacks.sort(), handled.toSorted());
});
