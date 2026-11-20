import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../../packages/mokly/src/generated/sidecar/PageResult.js";
import { installBindings, startSidecar } from "../helpers/sidecar.js";

import { viteFixture } from "./vite/support.js";

export async function writeVitePackage(
  root: string,
  name: string,
  type: "module" | "commonjs",
) {
  const directory = path.join(root, "node_modules", name);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name,
      type,
      exports: { ".": { fixture: "./fixture.js", default: "./index.js" } },
    }),
  );
  for (const [file, value] of [
    ["index.js", name],
    ["fixture.js", `${name} condition`],
  ])
    await fs.writeFile(
      path.join(directory, file!),
      type === "module"
        ? `export default ${JSON.stringify(value)};`
        : `module.exports = ${JSON.stringify(value)};`,
    );
}

export interface LookupFixture {
  root: string;
  extra: string;
  params: BundleParams;
  sidecar: ReturnType<typeof startSidecar>;
  render(bundle: BundleResult): Promise<PageResult>;
}

export async function lookupFixture(
  context: TestContext,
  side: "head" | "base",
): Promise<LookupFixture> {
  const fixture = await viteFixture(context);
  const extra = path.join(fixture.parent, "extra");
  await writeVitePackage(extra, "root-esm", "module");
  await writeVitePackage(extra, "root-cjs", "commonjs");
  await fs.writeFile(
    path.join(fixture.root, "vite.config.ts"),
    `
    import esm from "root-esm";
    import { createRequire } from "node:module";
    const cjs = createRequire(import.meta.url)("root-cjs");
    export default {
      environments: { ssr: { resolve: { conditions: ["fixture", "node"], externalConditions: ["fixture", "node"] } } },
      define: { __SETUP__: JSON.stringify(esm + "|" + cjs) },
    };
  `,
  );
  await fs.writeFile(
    path.join(fixture.root, "src/lookup.mockup.ts"),
    `
    import esm from "root-esm";
    import cjs from "root-cjs";
    import { definePage } from "@mokly/mokly";
    export const page = definePage({
      title: "Lookup", description: "", relatedDocs: [],
      render: () => "<html><head></head><body>" + esm + "|" + cjs + "|" + __SETUP__ + "</body></html>",
    });
  `,
  );
  let root = fixture.root;
  if (side === "base") {
    root = path.join(fixture.parent, "extraction");
    await fs.cp(fixture.root, root, {
      recursive: true,
      filter: (file) => path.basename(file) !== "node_modules",
    });
  }
  const params: BundleParams = {
    ...fixture.params,
    sourceRoot: root,
    renderer: null,
    entryFiles: ["src/lookup.mockup.ts"],
    repositoryRoots: [fixture.root],
    moduleResolution: {
      ...fixture.params.moduleResolution,
      ...(side === "base" ? { dependencyRoot: fixture.root } : {}),
      packageRoots: [extra, path.resolve(".")],
    },
  };
  const sidecar = startSidecar(context, root);
  await sidecar.call("hello");
  return {
    root,
    extra,
    params,
    sidecar,
    async render(bundle) {
      await installBindings(sidecar, bundle.generation);
      return sidecar.call<PageResult>("renderPage", {
        generation: bundle.generation,
        handle: "src/lookup.mockup.ts#page",
      });
    },
  };
}
