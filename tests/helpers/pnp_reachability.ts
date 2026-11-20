import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

import { nativeParams, nativeRoot, write } from "./native_resolution.js";

interface NestedPnp {
  root: string;
  inner: string;
  outer: string;
  state: string;
  params: BundleParams;
  owner(
    reference: "inner" | "outer",
    overlap?: boolean,
    registryDirectory?: string,
  ): Promise<void>;
  unrelated(): Promise<void>;
  addPreferred(): Promise<void>;
}

export async function nestedPnp(
  context: TestContext,
  tiered = false,
): Promise<NestedPnp> {
  const parent = await nativeRoot(context);
  const root = path.join(parent, "catalogue");
  const dependency = path.join(parent, "dependencies");
  const outer = tiered
    ? path.join(dependency, "node_modules/chosen")
    : path.join(root, ".yarn/chosen");
  const inner = path.join(outer, "inner");
  const state = path.join(root, ".pnp.data.json");
  const location = (directory: string, registryDirectory: string) =>
    (path.relative(registryDirectory, directory).split(path.sep).join("/") ||
      ".") + "/";
  const owner = (
    reference: "inner" | "outer",
    overlap = false,
    registryDirectory = root,
  ) =>
    write(
      path.join(registryDirectory, ".pnp.data.json"),
      JSON.stringify({
        enableTopLevelFallback: false,
        ...(overlap ? { fallbackPool: [["chosen", "workspace:outer"]] } : {}),
        packageRegistryData: [
          [
            null,
            [
              [
                null,
                {
                  packageLocation: location(root, registryDirectory),
                  packageDependencies: [["chosen", `workspace:${reference}`]],
                },
              ],
            ],
          ],
          [
            "chosen",
            [
              [
                "workspace:outer",
                {
                  packageLocation: location(outer, registryDirectory),
                  packageDependencies: [["chosen", "workspace:outer"]],
                },
              ],
              [
                "workspace:inner",
                {
                  packageLocation: location(inner, registryDirectory),
                  packageDependencies: [],
                },
              ],
            ],
          ],
        ],
      }),
    );
  await write(path.join(root, "package.json"), '{"name":"catalogue"}');
  await write(path.join(root, "tsconfig.json"), "{}");
  await write(
    path.join(root, "entry.mjs"),
    'export {value} from "chosen/sub/value";',
  );
  await write(
    path.join(outer, "package.json"),
    '{"name":"chosen","exports":{"./sub/":"./inner/lib/"}}',
  );
  await write(
    path.join(inner, "package.json"),
    '{"name":"chosen","exports":{"./sub/value":"./lib/value/index.js"}}',
  );
  await write(
    path.join(inner, "lib/value/index.js"),
    'export const value="original-index";',
  );
  await owner("inner");
  const params = nativeParams(root);
  if (tiered) {
    params.moduleResolution.dependencyRoot = dependency;
    params.moduleResolution.packageRoots = [root, dependency];
  }
  return {
    root,
    inner,
    outer,
    state,
    params,
    owner,
    unrelated: () => write(path.join(parent, "unrelated/new.ts"), "export {};"),
    addPreferred: () =>
      write(
        path.join(inner, "lib/value.ts"),
        'export const value="preferred-file";',
      ),
  };
}
