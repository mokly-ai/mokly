import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import { viteFixture } from "./fixtures/vite/support.js";
import { nativePeerFixture } from "./fixtures/vite_node_peers.js";
import { reviewFixture, reviewPage } from "./fixtures/vite_review.js";
import type { ReviewFixture } from "./fixtures/vite_review.js";
import { reportDuration } from "./helpers/durations.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

test("native Vite dependencies share the side's React peers in live and restored generations", async (context) => {
  await reportDuration(
    "Vite native React peers",
    (line) => context.diagnostic(line),
    async () => {
      const fixture = await viteFixture(context);
      const modules = await nativePeerFixture(fixture.root, fixture.parent);
      const params = {
        ...fixture.params,
        entryFiles: ["src/native.mockup.tsx"],
        renderer: null,
        moduleResolution: {
          ...fixture.params.moduleResolution,
          packageRoots: [
            modules,
            ...fixture.params.moduleResolution.packageRoots,
          ],
        },
      };
      const live = startSidecar(context, fixture.root);
      await live.call("hello");
      const bundle = await live.call<BundleResult>("bundle", params);
      const restored = startSidecar(context, fixture.root);
      await restored.call("hello");
      for (const sidecar of [live, restored]) {
        await assert.doesNotReject(async () => {
          await sidecar.call("restoreGeneration", { ...bundle, params });
          await sidecar.call("cssModules", {
            generation: bundle.generation,
            classMaps: {},
          });
          await installBindings(sidecar, bundle.generation);
          const result = await sidecar.call<RenderResult>("renderScreen", {
            generation: bundle.generation,
            handle: "src/native.mockup.tsx#screen",
            entry: { path: "native", title: "Native" },
            props: {},
            viewport: "mobile",
            colorScheme: "light",
          });
          assert.equal(
            result.html,
            "<p>esm=true;cjs=true;lazy=true;scope=true</p>",
          );
        });
        await sidecar.call("shutdown");
        await fs.rm(path.join(fixture.root, "src"), {
          recursive: true,
          force: true,
        });
      }
    },
  );
});

test("a restored Vite generation cannot reuse a native ES module linked to other React peers", async (context) => {
  const fixture = await reviewFixture(context);
  const packages = path.join(fixture.parent, "extra");
  const dependency = path.join(packages, "node_modules", "fixture-esm-peer");
  await fs.mkdir(dependency, { recursive: true });
  await fs.writeFile(
    path.join(dependency, "package.json"),
    '{"name":"fixture-esm-peer","exports":"./index.mjs"}',
  );
  await fs.writeFile(
    path.join(dependency, "index.mjs"),
    'import React from "react"; export const same = value => value === React;',
  );
  const react = path.join(packages, "node_modules", "react");
  await fs.cp(path.resolve("node_modules/react"), react, { recursive: true });
  fixture.params.moduleResolution.packageRoots.unshift(packages);
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage(
      "String(same(React))",
      'import React from "react"; import { same } from "fixture-esm-peer";',
    ),
  );
  const selectReact = (directory: string) =>
    fixture.write(
      "vite.config.mjs",
      `export default { resolve: { alias: [{ find: /^react$/, replacement: ${JSON.stringify(path.join(directory, "index.js"))} }] } };`,
    );
  await selectReact(path.resolve("node_modules/react"));
  const first = await fixture.compile();
  assert.match((await fixture.render(first)).html, /<body>true<\/body>/);

  await selectReact(react);
  const second = await compileOnAnotherWorker(context, fixture);
  assert.notEqual(second.compiled.peers.react, first.compiled.peers.react);
  await restoreBundle(fixture, second);
  await assert.rejects(fixture.render(second), {
    code: "fresh-worker-required",
  });
  await fixture.replaceWorker();
  await restoreBundle(fixture, second);
  assert.match((await fixture.render(second)).html, /<body>true<\/body>/);
  await fixture.sidecar.call("shutdown");
});

test("a restored Vite generation uses a fresh worker when a native package manifest changes", async (context) => {
  const fixture = await reviewFixture(context);
  const installed = "installed/node_modules/fixture-native";
  const manifest = `${installed}/package.json`;
  const stub = `${installed}/index.mjs`;
  const child = `${installed}/child.mjs`;
  const update = async (version: string, label: string) => {
    await fixture.write(
      manifest,
      JSON.stringify({
        name: "fixture-native",
        version,
        exports: "./index.mjs",
      }),
    );
    await fixture.write(child, `export default ${JSON.stringify(label)};`);
  };
  fixture.params.moduleResolution.packageRoots.unshift(
    path.join(fixture.root, "installed"),
  );
  await fixture.write(stub, 'export { default } from "./child.mjs";');
  await update("1.0.0", "before");
  await fixture.write(
    "src/review.mockup.ts",
    reviewPage("value", 'import value from "fixture-native";'),
  );
  const first = await fixture.compile();
  assert.match((await fixture.render(first)).html, /<body>before<\/body>/);

  await update("1.0.1", "upgrade");
  const second = await compileOnAnotherWorker(context, fixture);
  assert.deepEqual(second.compiled.peers, first.compiled.peers);
  const stubPath = path.join(fixture.root, stub);
  assert.equal(
    second.compiled.inputs[stubPath],
    first.compiled.inputs[stubPath],
  );
  assert.equal(
    second.compiled.inputs[path.join(fixture.root, child)],
    undefined,
  );
  await restoreBundle(fixture, second);
  await assert.rejects(fixture.render(second), {
    code: "fresh-worker-required",
  });
  await fixture.replaceWorker();
  await restoreBundle(fixture, second);
  assert.match((await fixture.render(second)).html, /<body>upgrade<\/body>/);
  await fixture.sidecar.call("shutdown");
});

async function compileOnAnotherWorker(
  context: TestContext,
  fixture: ReviewFixture,
) {
  const compiler = startSidecar(context, fixture.root);
  await compiler.call("hello");
  const bundle = await compiler.call<BundleResult>("bundle", fixture.params);
  await compiler.call("shutdown");
  return bundle;
}

function restoreBundle(fixture: ReviewFixture, bundle: BundleResult) {
  return fixture.sidecar.call("restoreGeneration", {
    ...bundle,
    params: fixture.params,
  });
}
