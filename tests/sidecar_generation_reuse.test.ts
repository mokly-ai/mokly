import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

test("evaluation-only bundles share compilation and fresh workers restore captured code", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-compiled-replay-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, "card.module.css"),
    ".card { color: red }",
  );
  await fs.writeFile(
    path.join(root, "page.mjs"),
    `import {definePage} from '@mokly/mokly'; import map from './card.module.css'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<main class="'+map.card+'">Saved</main>'});`,
  );
  const first = startSidecar(context);
  const second = startSidecar(context);
  await first.call("hello");
  await second.call("hello");
  const params = bundleParams({
    sourceRoot: root,
    renderer: null,
    entryFiles: ["page.mjs"],
    storiesFiles: [],
    evaluation: "old",
  });
  const old = await first.call<BundleResult>("bundle", params);
  assert.ok(old.compiled);
  await first.call("cssModules", {
    generation: old.generation,
    classMaps: { "card.module.css": { card: "old" } },
  });
  await installBindings(first, old.generation);
  const changed = await first.call<BundleResult>("bundle", {
    ...params,
    evaluation: "new",
  });
  assert.notEqual(changed.generation, old.generation);
  assert.equal(changed.compiled?.identity, old.compiled.identity);
  assert.equal(
    first.operations.filter((event) => event.operation === "esbuild").length,
    1,
  );
  await first.call("cssModules", {
    generation: changed.generation,
    classMaps: { "card.module.css": { card: "new" } },
  });
  await installBindings(first, changed.generation);
  const render = (sidecar: typeof first, generation: string) =>
    sidecar.call<PageResult>("renderPage", {
      generation,
      handle: "page.mjs#default",
    });
  assert.equal(
    (await render(first, old.generation)).html,
    '<main class="old">Saved</main>',
  );
  assert.equal(
    (await render(first, changed.generation)).html,
    '<main class="new">Saved</main>',
  );
  const repeated = await first.call<BundleResult>("bundle", params);
  assert.equal(repeated.generation, old.generation);
  await first.call("cssModules", {
    generation: repeated.generation,
    classMaps: { "card.module.css": { card: "old" } },
  });
  await installBindings(first, repeated.generation);
  assert.equal(
    (await render(first, repeated.generation)).html,
    '<main class="old">Saved</main>',
  );
  assert.equal(
    first.operations.filter((event) => event.operation === "esbuild").length,
    1,
  );
  await fs.writeFile(
    path.join(root, "page.mjs"),
    'throw new Error("current bytes must not run")',
  );
  await fs.rm(path.join(root, "card.module.css"));
  await second.call("restoreGeneration", {
    generation: old.generation,
    params,
    compiled: old.compiled,
    modules: old.modules,
  });
  await second.call("cssModules", {
    generation: old.generation,
    classMaps: { "card.module.css": { card: "old" } },
  });
  await installBindings(second, old.generation);
  assert.equal(
    (await render(second, old.generation)).html,
    '<main class="old">Saved</main>',
  );
  assert.equal(
    second.operations.filter((event) => event.operation === "esbuild").length,
    0,
  );
  await first.call("shutdown");
  await second.call("shutdown");
});
