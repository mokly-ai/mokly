import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

for (const layout of ["npm", "pnpm"])
  test(`${layout} repository links read the requested side and fail for absent sources`, async (context) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-side-links-"));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const head = path.join(root, "head");
    const base = path.join(root, "base");
    for (const [directory, value] of [
      [head, "Head"],
      [base, "Base"],
    ]) {
      await fs.mkdir(path.join(directory!, "packages/local"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(directory!, "entry.mjs"),
        'export { page } from "local";',
      );
      await fs.writeFile(
        path.join(directory!, "packages/local/package.json"),
        JSON.stringify({ name: "local", main: "index.mjs" }),
      );
      await fs.writeFile(
        path.join(directory!, "packages/local/index.mjs"),
        `import {definePage} from '@mokly/mokly'; export const page=definePage({title:'Local',description:'',relatedDocs:[],render:()=>'<html>${value}</html>'});`,
      );
    }
    const modules = path.join(head, "node_modules");
    await fs.mkdir(modules, { recursive: true });
    if (layout === "npm")
      await fs.symlink(
        path.join(head, "packages/local"),
        path.join(modules, "local"),
        "junction",
      );
    else {
      const store = path.join(
        modules,
        ".pnpm/local@file+packages+local/node_modules",
      );
      await fs.mkdir(store, { recursive: true });
      await fs.symlink(
        path.join(head, "packages/local"),
        path.join(store, "local"),
        "junction",
      );
      await fs.symlink(
        path.join(store, "local"),
        path.join(modules, "local"),
        "junction",
      );
    }
    const sidecar = startSidecar(context);
    await sidecar.call("hello");
    const params = bundleParams({
      sourceRoot: base,
      repositoryRoots: [head, base],
      entryFiles: ["entry.mjs"],
      storiesFiles: [],
      renderer: null,
      moduleResolution: {
        ...bundleParams().moduleResolution,
        packageRoots: [modules],
      },
    });
    const { generation, modules: graph } = await sidecar.call<BundleResult>(
      "bundle",
      params,
    );
    assert.ok(
      graph.some((module) => module.path === "packages/local/index.mjs"),
    );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    const definitions = await sidecar.call<Definitions>("describe", {
      generation,
    });
    assert.equal(definitions.pages[0]?.sourcePath, "packages/local/index.mjs");
    await installBindings(sidecar, generation);
    assert.equal(
      (
        await sidecar.call<PageResult>("renderPage", {
          generation,
          handle: "entry.mjs#page",
        })
      ).html,
      "<html>Base</html>",
    );
    await fs.rm(path.join(base, "packages/local/index.mjs"));
    await assert.rejects(sidecar.call("bundle", params), {
      code: "bundle-failed",
      message: /packages[\\/]local[\\/]index.mjs/,
    });
  });
