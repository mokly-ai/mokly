import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";
import { dependency, sidecarSources } from "./helpers/sidecar_sources.js";

for (const alias of [false, true]) {
  test(`base tsconfig ${alias ? "paths override packages" : "does not inherit head paths"}`, async (context) => {
    const { head, base } = await sidecarSources(context);
    await dependency(head, "fixture-value", "export default 'package';");
    for (const [root, value] of [
      [head, "head"],
      [base, "base"],
    ]) {
      await fs.writeFile(
        path.join(root!, "value.mjs"),
        `export default '${value}';`,
      );
      await fs.writeFile(
        path.join(root!, "tsconfig.json"),
        JSON.stringify({
          compilerOptions:
            root === head || alias
              ? { paths: { "fixture-value": ["./value.mjs"] } }
              : {},
        }),
      );
    }
    await fs.writeFile(
      path.join(base, "page.ts"),
      "import {definePage} from '@mokly/mokly'; import value from 'fixture-value'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<html>'+value+'</html>'});",
    );
    const sidecar = startSidecar(context, base);
    await sidecar.call("hello");
    const result = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        sourceRoot: base,
        repositoryRoots: [head],
        renderer: null,
        storiesFiles: [],
        entryFiles: ["page.ts"],
        moduleResolution: {
          ...bundleParams().moduleResolution,
          packageRoots: [head],
          dependencyRoot: head,
        },
      }),
    );
    await sidecar.call("cssModules", {
      generation: result.generation,
      classMaps: {},
    });
    await installBindings(sidecar, result.generation);
    const page = await sidecar.call<PageResult>("renderPage", {
      generation: result.generation,
      handle: "page.ts#default",
    });
    assert.equal(page.html, `<html>${alias ? "base" : "package"}</html>`);
    await sidecar.call("shutdown");
  });
}

test("a newly installed nearer package invalidates the retained base recipe", async (context) => {
  const { head, base } = await sidecarSources(context);
  await dependency(head, "fixture-value", "export default 'root';");
  await fs.mkdir(path.join(base, "packages/ui"), { recursive: true });
  await fs.writeFile(
    path.join(base, "packages/ui/page.ts"),
    "import value from 'fixture-value'; export default value;",
  );
  const params = bundleParams({
    sourceRoot: base,
    repositoryRoots: [head],
    renderer: null,
    storiesFiles: [],
    entryFiles: ["packages/ui/page.ts"],
    moduleResolution: {
      ...bundleParams().moduleResolution,
      dependencyRoot: head,
      packageRoots: [head],
    },
  });
  const sidecar = startSidecar(context, base);
  await sidecar.call("hello");
  const before = await sidecar.call<BundleResult>("bundle", params);
  await dependency(
    path.join(head, "packages/ui"),
    "fixture-value",
    "export default 'nearer';",
  );
  const after = await sidecar.call<BundleResult>("bundle", params);
  assert.notEqual(before.generation, after.generation);
  assert.ok(
    after.modules.some(
      (module) =>
        module.path === "packages/ui/node_modules/fixture-value/index.mjs",
    ),
  );
  await sidecar.call("shutdown");
});

test("base package scopes preserve import conditions and pnpm links", async (context) => {
  const { head, base } = await sidecarSources(context);
  const store = await dependency(
    path.join(head, "node_modules/.pnpm/store"),
    "fixture-value",
    "export default 'wrong';",
  );
  await fs.writeFile(
    path.join(store, "package.json"),
    JSON.stringify({
      name: "fixture-value",
      exports: { mokly: "./selected.mjs", default: "./index.mjs" },
    }),
  );
  await fs.writeFile(
    path.join(store, "selected.mjs"),
    "export default 'selected';",
  );
  await fs.mkdir(path.join(head, "packages/ui/node_modules"), {
    recursive: true,
  });
  await fs.symlink(
    store,
    path.join(head, "packages/ui/node_modules/fixture-value"),
    "junction",
  );
  await fs.mkdir(path.join(base, "packages/ui"), { recursive: true });
  await fs.writeFile(
    path.join(base, "packages/ui/page.ts"),
    "import {definePage} from '@mokly/mokly'; import value from 'fixture-value'; export default definePage({title:'Page',description:'',relatedDocs:[],render:()=>'<html>'+value+'</html>'});",
  );
  const sidecar = startSidecar(context, base);
  await sidecar.call("hello");
  const result = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      sourceRoot: base,
      repositoryRoots: [head],
      renderer: null,
      storiesFiles: [],
      entryFiles: ["packages/ui/page.ts"],
      moduleResolution: {
        ...bundleParams().moduleResolution,
        conditions: ["mokly"],
        dependencyRoot: head,
        packageRoots: [head],
      },
    }),
  );
  await sidecar.call("cssModules", {
    generation: result.generation,
    classMaps: {},
  });
  await installBindings(sidecar, result.generation);
  assert.equal(
    (
      await sidecar.call<PageResult>("renderPage", {
        generation: result.generation,
        handle: "packages/ui/page.ts#default",
      })
    ).html,
    "<html>selected</html>",
  );
  await sidecar.call("shutdown");
});

test("base CSS text keeps the compiled JavaScript recipe", async (context) => {
  const { head, base } = await sidecarSources(context);
  const pkg = await dependency(
    head,
    "fixture-value",
    "export default 'value';",
  );
  await fs.writeFile(path.join(pkg, "index.css"), ".fixture{color:red}");
  await fs.writeFile(
    path.join(base, "entry.ts"),
    "import value from 'fixture-value'; import 'fixture-value/index.css'; export default value;",
  );
  const sidecar = startSidecar(context, base);
  await sidecar.call("hello");
  const params = bundleParams({
    sourceRoot: base,
    repositoryRoots: [head],
    renderer: null,
    storiesFiles: [],
    entryFiles: ["entry.ts"],
    moduleResolution: {
      ...bundleParams().moduleResolution,
      dependencyRoot: head,
      packageRoots: [head],
    },
  });
  const before = await sidecar.call<BundleResult>("bundle", params);
  await fs.writeFile(path.join(pkg, "index.css"), ".fixture{color:blue}");
  const after = await sidecar.call<BundleResult>("bundle", params);
  assert.equal(after.generation, before.generation);
  assert.equal(
    sidecar.operations.filter((event) => event.operation === "esbuild").length,
    1,
  );
  await sidecar.call("shutdown");
});
