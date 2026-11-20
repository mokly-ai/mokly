import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

import { link, nativeParams, nativeRoot, write } from "./native_resolution.js";

export interface FolderCase {
  name: string;
  route?: "installed" | "linked" | "alias" | "nodePaths" | "dependency";
  manifest?: string;
  request?: string;
  original?: string;
  preferred?: string;
  extra?: string[];
  nestedManifest?: string;
  expected?: string;
  mainFields?: string[];
  brokenCandidate?: boolean;
}

interface FolderFixture {
  root: string;
  pkg: string;
  params: BundleParams;
  dependency: string;
  original: string;
  preferred: string;
  unrelated(): Promise<void>;
  addPreferred(): Promise<void>;
}

export async function folderPackage(
  context: TestContext,
  row: FolderCase,
  parentDirectory?: string,
): Promise<FolderFixture> {
  const parent = await nativeRoot(context, parentDirectory);
  const root = path.join(parent, "catalogue");
  const dependency = path.join(root, "node_modules/consumer/index.mjs");
  const pkg =
    row.route === "installed" || row.route === "dependency"
      ? path.join(root, "node_modules/chosen")
      : row.route === "linked"
        ? path.join(
            root,
            "node_modules/.pnpm/chosen%20literal/node_modules/chosen",
          )
        : row.route === "nodePaths"
          ? path.join(parent, "lookup/node_modules/chosen")
          : root;
  const original = row.original ?? "lib/value/index.js";
  const preferred = row.preferred ?? "lib/value.ts";
  await fs.mkdir(path.join(parent, "unrelated"), { recursive: true });
  await write(
    path.join(pkg, "package.json"),
    row.manifest ?? '{"name":"chosen","exports":{"./sub/":"./lib/"}}',
  );
  await write(path.join(pkg, original), 'export const value="original-index";');
  for (const file of row.extra ?? [])
    await write(path.join(pkg, file), 'export const value="unused-index";');
  if (row.nestedManifest)
    await write(path.join(pkg, "lib/value/package.json"), row.nestedManifest);
  if (row.route === "linked")
    await link(pkg, path.join(root, "node_modules/chosen"));
  const request = row.request ?? "chosen/sub/value";
  if (row.route === "dependency") {
    await write(dependency, `export {value} from ${JSON.stringify(request)};`);
    await write(
      path.dirname(dependency) + "/package.json",
      '{"main":"index.mjs"}',
    );
  }
  await write(
    path.join(root, "entry.mjs"),
    `export {value} from ${JSON.stringify(row.route === "dependency" ? "consumer" : request)};`,
  );
  const params = nativeParams(root);
  params.moduleResolution.mainFields = row.mainFields ?? [];
  if (row.route === "alias") {
    params.configurationDirectory = "configuration";
    await fs.mkdir(path.join(root, "configuration"));
    params.moduleResolution.aliases = { shortcut: "chosen" };
  }
  if (row.route === "nodePaths")
    params.moduleResolution.packageRoots = [path.join(parent, "lookup")];
  const appearance = row.brokenCandidate
    ? path.join(root, "targets/preferred.ts")
    : path.join(pkg, preferred);
  if (row.brokenCandidate) {
    await fs.mkdir(path.dirname(appearance), { recursive: true });
    await fs.symlink(appearance, path.join(pkg, preferred), "file");
  }
  return {
    root,
    pkg,
    params,
    dependency,
    original: path.join(pkg, original),
    preferred: path.join(pkg, preferred),
    unrelated: () => write(path.join(parent, "unrelated/new.ts"), "export {};"),
    addPreferred: () =>
      write(appearance, 'export const value="preferred-file";'),
  };
}
