import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

import { nativeParams, nativeRoot, write } from "./native_resolution.js";

export type PnpForm = "json" | "binding" | "object" | "concatenation";

interface PnpFixture {
  root: string;
  params: BundleParams;
  addPreferred(): Promise<void>;
  unrelated(): Promise<void>;
}

export async function pnpFolder(
  context: TestContext,
  form: PnpForm,
  folder = true,
  aliased = false,
): Promise<PnpFixture> {
  const parent = await nativeRoot(context);
  const root = path.join(parent, "catalogue");
  const pkg = path.join(root, ".yarn/chosen");
  const ident = aliased ? "actual" : "chosen";
  const info = `{"packageLocation":"./.yarn/chosen/","packageLocation":"./.yarn/unused/","packageDependencies":[]}`;
  const registry =
    JSON.stringify([
      [
        null,
        [
          [
            null,
            {
              packageLocation: "./",
              packageDependencies: [
                [
                  "chosen",
                  aliased ? [ident, "workspace:chosen"] : "workspace:chosen",
                ],
              ],
            },
          ],
        ],
      ],
    ]).slice(0, -1) +
    `,[${JSON.stringify(ident)},[["workspace:chosen",${info}]]]]`;
  const data = `{"enableTopLevelFallback":false,"packageRegistryData":${registry},"packageRegistryData":[]}`;
  const manifest =
    form === "json"
      ? data
      : form === "binding"
        ? `const RAW_RUNTIME_STATE=${JSON.stringify(data)}; hydrateRuntimeState(JSON.parse(RAW_RUNTIME_STATE));`
        : form === "object"
          ? `hydrateRuntimeState(${data});`
          : `hydrateRuntimeState(JSON.parse(${JSON.stringify(data.slice(0, 10))}+${JSON.stringify(data.slice(10))}));`;
  await write(
    path.join(root, form === "json" ? ".pnp.data.json" : ".pnp.cjs"),
    manifest,
  );
  await write(
    path.join(root, "entry.mjs"),
    `export {value} from "${aliased ? "shortcut" : "chosen"}/sub/value";`,
  );
  await write(
    path.join(pkg, "package.json"),
    JSON.stringify({
      name: ident,
      exports: folder
        ? { "./sub/": "./lib/" }
        : { "./sub/value": "./lib/value.js" },
    }),
  );
  await write(
    path.join(root, ".yarn/unused/package.json"),
    '{"exports":{"./sub/":"./lib/"}}',
  );
  await write(
    path.join(root, ".yarn/unused/lib/value/index.js"),
    "export const value='unused';",
  );
  await write(
    path.join(pkg, folder ? "lib/value/index.js" : "lib/value.js"),
    'export const value="original-index";',
  );
  await write(path.join(parent, "unrelated/.keep"), "");
  const params = nativeParams(root);
  if (aliased) params.moduleResolution.aliases = { shortcut: "chosen" };
  return {
    root,
    params,
    addPreferred: () =>
      write(
        path.join(pkg, "lib/value.ts"),
        'export const value="preferred-file";',
      ),
    unrelated: () => write(path.join(parent, "unrelated/new.ts"), "export {};"),
  };
}
