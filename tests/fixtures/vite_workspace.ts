import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { BundleResult } from "../../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../../packages/mokly/src/generated/sidecar/PageResult.js";
import type { SourcePackage } from "../../packages/mokly/src/generated/sidecar/SourcePackage.js";
import { link, nativeParams, write } from "../helpers/native_resolution.js";
import { installBindings } from "../helpers/sidecar.js";
import type { startSidecar } from "../helpers/sidecar.js";

import { viteFixture } from "./vite/support.js";

export const sides = ["head", "base"] as const;
type Side = (typeof sides)[number];

export const pkg = "packages/local";
export const entry = "src/workspace.mockup.ts";
export const stylesheet = "src/workspace.css";
export const buildValue = (side: Side) =>
  `export const value = "built ${side}";`;
export const sourceValue = (side: Side) =>
  `export const value: string = "source ${side}";`;

interface Layout {
  specifier: string;
  build: string;
  source: string;
  sourcePackages?: Record<string, SourcePackage>[];
  keepBaseBuild?: boolean;
}

export async function workspace(context: TestContext, layout: Layout) {
  const fixture = await viteFixture(context);
  const head = fixture.root;
  const roots = { head, base: path.join(fixture.parent, "extraction") };
  await fs.rm(path.join(head, "vite.config.ts"));
  await fs.rm(path.join(head, "node_modules"), { recursive: true });
  await link(
    path.join(head, pkg),
    path.join(head, "node_modules", layout.specifier),
  );
  const writeSide = (side: Side, file: string, contents: string) =>
    write(path.join(roots[side], file), contents);

  for (const side of sides) {
    await writeSide(side, "vite.config.mjs", "export default {};");
    await writeSide(
      side,
      `${pkg}/package.json`,
      JSON.stringify({
        name: layout.specifier,
        type: "module",
        exports: {
          ".": `./${layout.build}`,
          "./theme.css": "./dist/theme.css",
        },
      }),
    );
    await writeSide(side, `${pkg}/${layout.source}`, sourceValue(side));
    await writeSide(
      side,
      `${pkg}/src/theme.css`,
      `.source-${side} { color: teal }`,
    );
  }
  await writeSide("head", `${pkg}/${layout.build}`, buildValue("head"));
  await writeSide(
    "head",
    `${pkg}/dist/theme.css`,
    ".built-head { color: red }",
  );
  if (layout.keepBaseBuild)
    await writeSide("base", `${pkg}/${layout.build}`, buildValue("base"));

  return {
    roots,
    write: writeSide,
    params: (side: Side, vite = true) =>
      nativeParams(
        roots[side],
        { vite, repositoryRoots: [head], entryFiles: [entry] },
        {
          ...(side === "base" ? { dependencyRoot: head } : {}),
          packageRoots: [head, ...fixture.params.moduleResolution.packageRoots],
          sourcePackages: layout.sourcePackages ?? [],
        },
      ),
  };
}

export const probe = {
  specifier: "local",
  build: "dist/value.js",
  source: "src/value.ts",
};

export async function renderWorkspacePage(
  sidecar: ReturnType<typeof startSidecar>,
  params: BundleParams,
): Promise<string> {
  const { generation } = await sidecar.call<BundleResult>("bundle", params);
  await installBindings(sidecar, generation);
  const result = await sidecar.call<PageResult>("renderPage", {
    generation,
    handle: `${entry}#page`,
  });
  return result.html;
}
