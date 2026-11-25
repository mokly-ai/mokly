import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  file,
  frameworkProject,
  main,
  module,
  selection,
} from "./fixtures/storybook_framework.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";

for (const adapter of ["esbuild", "Vite"]) {
  test(`${adapter} loads main.ts through a framework-only installation and rebundles on input edits`, async (context) => {
    const { root, params, folder } = await frameworkProject(
      context,
      adapter === "Vite",
    );
    const sidecar = startSidecar(context, root);
    await sidecar.call("hello");
    const first = await sidecar.call<BundleResult>("bundle", params);
    assert.equal(first.compiled.peers["@storybook/react"], null);
    assert.match(
      first.compiled.storybookReact?.[folder] ?? "",
      /fixture-framework[/\\]node_modules[/\\]@storybook[/\\]react/,
    );
    for (const input of [main, module, selection]) {
      const digest = createHash("sha256")
        .update(await fs.readFile(path.join(root, input)))
        .digest("hex");
      assert.equal(first.compiled.metadataInputs[input], digest, input);
    }
    await sidecar.call("cssModules", {
      generation: first.generation,
      classMaps: {},
    });
    await installBindings(sidecar, first.generation);
    const rendered = await sidecar.call<RenderResult>("renderStory", {
      generation: first.generation,
      storyId: `${file}#Primary`,
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    });
    assert.equal(rendered.html, "<output>framework preview</output>");
    await fs.writeFile(path.join(root, selection), "other-framework");
    const edited = await sidecar.call<BundleResult>("bundle", params);
    assert.notEqual(edited.generation, first.generation);
    assert.match(
      edited.compiled.storybookReact?.[folder] ?? "",
      /other-framework[/\\]node_modules[/\\]@storybook[/\\]react/,
    );
  });
}

test("main loader failures report the file, version, and range and a direct renderer bypasses main", async (context) => {
  const { root, params, uiLibraries } = await frameworkProject(context);
  const sidecar = startSidecar(context, root);
  await sidecar.call("hello");
  await fs.writeFile(
    path.join(root, main),
    'throw new Error("main setup failed");',
  );
  const { devDependencies } = JSON.parse(
    await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { devDependencies: Record<string, string> };
  const { version } = JSON.parse(
    await fs.readFile(path.join(uiLibraries, "storybook/package.json"), "utf8"),
  ) as { version: string };
  const expected = `${main}: Storybook ${version} (tested ${devDependencies["@storybook/react"]}): main setup failed`;
  await assert.rejects(sidecar.call("bundle", params), (error: unknown) => {
    assert.ok(error instanceof Error && "code" in error);
    assert.ok(error.message.includes(expected), error.message);
    assert.equal(error.code, "bundle-failed");
    return true;
  });
  const direct = path.join(root, "node_modules/@storybook");
  await fs.mkdir(direct, { recursive: true });
  await fs.rename(
    path.join(uiLibraries, "fixture-framework/node_modules/@storybook/react"),
    path.join(direct, "react"),
  );
  const result = await sidecar.call<BundleResult>("bundle", params);
  assert.equal(result.compiled.metadataInputs[main], undefined);
  assert.equal(result.compiled.storybookReact, undefined);
  assert.match(
    result.compiled.peers["@storybook/react"] ?? "",
    /[/\\]node_modules[/\\]@storybook[/\\]react[/\\]/,
  );
});
