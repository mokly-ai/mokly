import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../../packages/mokly/src/generated/sidecar/BundleParams.js";
import { bundleParams, startSidecar } from "../../helpers/sidecar.js";

interface ViteFixture {
  root: string;
  parent: string;
  params: BundleParams;
  output: string;
}

export async function viteFixture(context: TestContext): Promise<ViteFixture> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-vite-"));
  context.after(() => fs.rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, "app");
  await fs.cp(path.resolve("tests/fixtures/vite"), root, {
    recursive: true,
    filter: (file) => path.basename(file) !== "support.ts",
  });
  await fs.symlink(
    path.resolve("node_modules"),
    path.join(root, "node_modules"),
    "junction",
  );
  const params = bundleParams({
    vite: true,
    sourceRoot: root,
    entryFiles: ["src/screen.mockup.tsx"],
    renderer: "src/renderer.jsx",
    storiesFiles: [],
  });
  return { root, parent, params, output: path.join(root, ".context/output") };
}

export async function viteFixtureWorker(
  context: TestContext,
  root: string,
): Promise<{
  readonly sidecar: ReturnType<typeof startSidecar>;
  replaceWorker(): Promise<void>;
}> {
  const start = async () => {
    const worker = startSidecar(context, root);
    await worker.call("hello");
    return worker;
  };
  let worker = await start();
  return {
    get sidecar() {
      return worker;
    },
    async replaceWorker() {
      await worker.call("shutdown");
      worker = await start();
    },
  };
}

export async function noViteProject(
  context: TestContext,
): Promise<BundleParams> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-no-vite-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  return bundleParams({
    vite: true,
    sourceRoot: root,
    entryFiles: [],
    renderer: null,
    storiesFiles: [],
    moduleResolution: { ...bundleParams().moduleResolution, packageRoots: [] },
  });
}

export function viteScreenFile(output: string): string {
  return path.join(output, "static/mokly-generated/vite/index.mobile.html");
}

export async function viteFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string) => {
    for (const entry of await fs.readdir(path.join(root, directory), {
      withFileTypes: true,
    })) {
      const file = path.join(directory, entry.name);
      files.push(file);
      if (entry.isDirectory()) await visit(file);
    }
  };
  await visit("");
  for (const cache of ["node_modules/.vite", "node_modules/.vite-temp"]) {
    try {
      files.push(
        cache,
        ...(await fs.readdir(path.join(root, cache), { recursive: true })),
      );
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
  }
  return files.sort();
}
