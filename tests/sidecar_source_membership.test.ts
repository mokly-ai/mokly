import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

test("tracked source directories do not hide installed lookup membership", async (context) => {
  const { head, base } = await sidecarSources(context);
  await fs.mkdir(path.join(head, "node_modules"));
  await fs.mkdir(path.join(head, "src/node_modules"), { recursive: true });
  await dependency(
    path.join(base, "src"),
    "tracked",
    "export default 'tracked';",
  );
  await fs.writeFile(
    path.join(head, "node_modules/fixture-value.js"),
    "module.exports='root';",
  );
  await fs.writeFile(
    path.join(base, "src/entry.ts"),
    "import value from 'fixture-value'; export default value;",
  );
  const params = bundleParams({
    sourceRoot: base,
    repositoryRoots: [head],
    entryFiles: ["src/entry.ts"],
    storiesFiles: [],
    renderer: null,
    moduleResolution: {
      ...bundleParams().moduleResolution,
      dependencyRoot: head,
      packageRoots: [head],
    },
  });
  const sidecar = startSidecar(context, base);
  await sidecar.call("hello");
  const before = await sidecar.call<BundleResult>("bundle", params);
  await fs.writeFile(
    path.join(head, "src/node_modules/fixture-value.js"),
    "module.exports='nearer';",
  );
  const after = await sidecar.call<BundleResult>("bundle", params);
  assert.notEqual(after.generation, before.generation);
  assert.ok(
    after.modules.some(
      (module) => module.path === "src/node_modules/fixture-value.js",
    ),
  );
  assert.equal(
    sidecar.operations.filter((event) => event.operation === "esbuild").length,
    2,
  );
  await sidecar.call("shutdown");
});
