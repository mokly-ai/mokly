import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  file,
  frameworkProject,
  main,
} from "./fixtures/storybook_framework.js";
import { viteFixtureWorker } from "./fixtures/vite/support.js";
import { link, packageAt } from "./helpers/native_resolution.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

test("conflicting Storybook framework reads make a Serve edit compilation ineligible for reuse", async (context) => {
  const { root, params, folder } = await frameworkProject(context);
  const secondFolder = "packages/ui/second-storybook";
  const secondStory = "packages/ui/second.stories.tsx";
  await fs.mkdir(path.join(root, secondFolder));
  await fs.copyFile(path.join(root, file), path.join(root, secondStory));
  await fs.writeFile(
    path.join(root, main),
    `import { readFileSync, writeFileSync } from "node:fs";
      const selection = new URL("./selection.txt", import.meta.url);
      export const framework = readFileSync(selection, "utf8");
      writeFileSync(selection, "other-framework");
      export default { framework };`,
  );
  await fs.writeFile(
    path.join(root, secondFolder, "main.ts"),
    `import { readFileSync } from "node:fs";
      const selection = new URL("../.storybook/selection.txt", import.meta.url);
      export default { framework: readFileSync(selection, "utf8") };`,
  );
  const sidecar = startSidecar(context, root);
  await sidecar.call("hello");
  const { compiled } = await sidecar.call<BundleResult>("bundle", {
    ...params,
    capture: "serveEdit",
    storiesFiles: [file, secondStory],
    storybookFolders: { [file]: folder, [secondStory]: secondFolder },
  });
  assert.match(compiled.storybookReact?.[folder] ?? "", /fixture-framework/);
  assert.match(
    compiled.storybookReact?.[secondFolder] ?? "",
    /other-framework/,
  );
  assert.equal(compiled.reuseEvidence.uncaptured, undefined);
  await sidecar.call("shutdown");
});

for (const adapter of ["esbuild", "Vite"]) {
  test(`${adapter} Serve edit replaces the framework renderer after a direct install`, async (context) => {
    const { root, params, folder, uiLibraries } = await frameworkProject(
      context,
      adapter === "Vite",
    );
    const worker = await viteFixtureWorker(context, root);
    const compile = () =>
      worker.sidecar.call<BundleResult>("bundle", {
        ...params,
        capture: "serveEdit",
      });
    const render = async ({ generation }: BundleResult) => {
      await worker.sidecar.call("cssModules", { generation, classMaps: {} });
      await installBindings(worker.sidecar, generation);
      return worker.sidecar.call<RenderResult>("renderStory", {
        generation,
        storyId: `${file}#Primary`,
        props: {},
        viewport: "mobile",
        colorScheme: "light",
      });
    };
    const first = await compile();
    const fallback = first.compiled.storybookReact?.[folder];
    assert.ok(fallback);
    assert.equal(first.compiled.peers["@storybook/react"], null);
    assert.equal(first.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.equal((await compile()).generation, first.generation);
    assert.equal(
      (await render(first)).html,
      "<output>framework preview</output>",
    );

    const direct = "node_modules/@storybook/react";
    const packageDirectory = path.join(root, direct);
    await packageAt(
      packageDirectory,
      "@storybook/react",
      `const { createElement } = require("react");
        const original = require(${JSON.stringify(fallback)});
        module.exports = {
          ...original,
          composeStories(stories) {
            return original.composeStories({
              ...stories,
              default: {
                ...stories.default,
                render: () => createElement("output", null, "direct renderer"),
              },
            });
          },
        };`,
      "index.cjs",
    );
    await link(
      path.join(uiLibraries, "storybook"),
      path.join(packageDirectory, "node_modules/storybook"),
    );
    if (params.vite) {
      await assert.rejects(compile(), { code: "fresh-worker-required" });
      await worker.replaceWorker();
    }
    const next = await compile();
    assert.notEqual(next.generation, first.generation);
    assert.equal(next.compiled.storybookReact, undefined);
    assert.equal(
      next.compiled.peers["@storybook/react"],
      path.join(packageDirectory, "index.cjs"),
    );
    assert.equal((await render(next)).html, "<output>direct renderer</output>");
    for (const candidate of [
      `${direct}/package.json`,
      `tools/${direct}/package.json`,
    ]) {
      assert.equal(first.compiled.metadataInputs[candidate], null, candidate);
      assert.equal(
        first.compiled.inputs[path.join(root, candidate)],
        null,
        candidate,
      );
    }
    await worker.sidecar.call("shutdown");
  });
}
