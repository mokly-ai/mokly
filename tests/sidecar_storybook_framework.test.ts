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
import { viteFixtureWorker } from "./fixtures/vite/support.js";
import { nativeRoot } from "./helpers/native_resolution.js";
import { installBindings, startSidecar } from "./helpers/sidecar.js";
import { dependency } from "./helpers/sidecar_sources.js";

for (const adapter of ["esbuild", "Vite"]) {
  test(`${adapter} loads main.ts through a framework-only installation and rebundles on input edits`, async (context) => {
    const { root, params, folder } = await frameworkProject(
      context,
      adapter === "Vite",
    );
    const worker = await viteFixtureWorker(context, root);
    const compile = () => worker.sidecar.call<BundleResult>("bundle", params);
    const recompile = params.vite
      ? async () => {
          await assert.rejects(compile(), { code: "fresh-worker-required" });
          await worker.replaceWorker();
          return compile();
        }
      : compile;
    const first = await compile();
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
    const laterCandidate = `${folder}/main.tsx`;
    assert.equal(first.compiled.metadataInputs[`${folder}/main.js`], null);
    assert.equal(first.compiled.metadataInputs[laterCandidate], null);
    await worker.sidecar.call("cssModules", {
      generation: first.generation,
      classMaps: {},
    });
    await installBindings(worker.sidecar, first.generation);
    const rendered = await worker.sidecar.call<RenderResult>("renderStory", {
      generation: first.generation,
      storyId: `${file}#Primary`,
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    });
    assert.equal(rendered.html, "<output>framework preview</output>");
    await fs.writeFile(path.join(root, selection), "other-framework");
    const edited = await recompile();
    assert.notEqual(edited.generation, first.generation);
    assert.match(
      edited.compiled.storybookReact?.[folder] ?? "",
      /other-framework[/\\]node_modules[/\\]@storybook[/\\]react/,
    );
    const laterSource = 'throw new Error("main.ts still takes precedence");';
    await fs.writeFile(path.join(root, laterCandidate), laterSource);
    const added = await recompile();
    assert.notEqual(added.generation, edited.generation);
    assert.equal(
      added.compiled.metadataInputs[laterCandidate],
      createHash("sha256").update(laterSource).digest("hex"),
    );
    assert.deepEqual(
      added.compiled.storybookReact,
      edited.compiled.storybookReact,
    );
  });

  test(`${adapter} loads a bare main import from the selected base installation`, async (context) => {
    const {
      root: installation,
      params,
      folder,
      uiLibraries,
    } = await frameworkProject(context, adapter === "Vite");
    const source = await nativeRoot(context);
    await fs.mkdir(path.join(source, "tools"));
    await fs.mkdir(path.join(source, folder), { recursive: true });
    await fs.copyFile(path.join(installation, file), path.join(source, file));
    await fs.copyFile(
      path.join(installation, folder, "preview.ts"),
      path.join(source, folder, "preview.ts"),
    );
    await dependency(
      path.dirname(uiLibraries),
      "base-framework",
      'export default "other-framework";',
    );
    await fs.writeFile(
      path.join(source, main),
      `
      import framework from "base-framework";
      export default { framework, stories: () => [] };
    `,
    );
    const { sidecar } = await viteFixtureWorker(context, source);
    const result = await sidecar.call<BundleResult>("bundle", {
      ...params,
      sourceRoot: source,
      repositoryRoots: [installation],
      moduleResolution: {
        ...params.moduleResolution,
        dependencyRoot: installation,
        packageRoots: [path.dirname(uiLibraries), installation],
      },
    });
    assert.match(
      result.compiled.storybookReact?.[folder] ?? "",
      /other-framework[/\\]node_modules[/\\]@storybook[/\\]react/,
    );
    assert.equal(
      Object.hasOwn(
        result.compiled.inputs,
        path.join(uiLibraries, "base-framework/index.mjs"),
      ),
      true,
    );
    assert.ok(
      result.unmappedDependencyDirectories?.includes(
        "packages/ui/node_modules",
      ),
    );
  });
}

test("a framework named by getAbsolutePath resolves an exports-only package", async (context) => {
  const { root, params, folder, uiLibraries } = await frameworkProject(context);
  await fs.writeFile(
    path.join(uiLibraries, "fixture-framework/package.json"),
    JSON.stringify({
      name: "fixture-framework",
      exports: { ".": "./index.cjs", "./package.json": "./package.json" },
    }),
  );
  await fs.writeFile(
    path.join(root, main),
    `
    import { createRequire } from "node:module";
    import { dirname } from "node:path";
    const require = createRequire(import.meta.url);
    const getAbsolutePath = (name: string) => dirname(require.resolve(name + "/package.json"));
    export default { framework: { name: getAbsolutePath("fixture-framework"), options: {} } };
  `,
  );
  const sidecar = startSidecar(context, root);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>("bundle", params);
  assert.match(
    result.compiled.storybookReact?.[folder] ?? "",
    /fixture-framework[/\\]node_modules[/\\]@storybook[/\\]react/,
  );
  await sidecar.call("shutdown");
});

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

test("Vite Serve edits read main only in the compile that uses it", async (context) => {
  const { root, params, uiLibraries } = await frameworkProject(context, true);
  const counts = path.join(root, "main-loads.txt");
  await fs.writeFile(counts, "");
  await fs.writeFile(
    path.join(root, main),
    `
    import { appendFileSync } from "node:fs";
    import framework from "./framework.js";
    appendFileSync(${JSON.stringify(counts)}, "load\\n");
    export default { framework };
    `,
  );
  const worker = await viteFixtureWorker(context, root);
  const compile = () =>
    worker.sidecar.call<BundleResult>("bundle", {
      ...params,
      capture: "serveEdit",
    });
  const loads = () => fs.readFile(counts, "utf8");
  const first = await compile();
  assert.equal(await loads(), "load\n");
  assert.equal((await compile()).generation, first.generation);
  assert.equal(await loads(), "load\n");
  await fs.appendFile(path.join(root, file), "\nexport const Secondary = {};");
  const miss = await compile();
  assert.notEqual(miss.generation, first.generation);
  assert.equal(await loads(), "load\nload\n");
  await fs.writeFile(path.join(root, selection), "other-framework");
  await assert.rejects(compile(), { code: "fresh-worker-required" });
  assert.equal(await loads(), "load\nload\n");
  await worker.replaceWorker();
  const restarted = await compile();
  assert.notEqual(restarted.generation, miss.generation);
  assert.equal(await loads(), "load\nload\nload\n");
  await fs.writeFile(path.join(root, main), 'throw new Error("broken main");');
  await worker.replaceWorker();
  const { version } = JSON.parse(
    await fs.readFile(path.join(uiLibraries, "storybook/package.json"), "utf8"),
  ) as { version: string };
  const { devDependencies } = JSON.parse(
    await fs.readFile(new URL("../package.json", import.meta.url), "utf8"),
  ) as { devDependencies: Record<string, string> };
  await assert.rejects(compile(), (error: unknown) => {
    assert.ok(error instanceof Error && "code" in error);
    assert.equal(error.code, "bundle-failed");
    assert.ok(
      error.message.includes(
        `${main}: Storybook ${version} (tested ${devDependencies["@storybook/react"]}): broken main`,
      ),
      error.message,
    );
    return true;
  });
});
