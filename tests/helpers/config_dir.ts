import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

import { nativeParams, nativeRoot, write } from "./native_resolution.js";

interface ConfigDirFixture {
  root: string;
  params: BundleParams;
  addEarlier(): Promise<void>;
}

export async function configDirPaths(
  context: TestContext,
): Promise<ConfigDirFixture> {
  const root = await nativeRoot(context);
  await write(path.join(root, "package.json"), "{}");
  await write(path.join(root, "one/.keep"), "");
  await write(path.join(root, "two/value.js"), "export const value='two';");
  await write(
    path.join(root, "entry.mjs"),
    "export {value} from '@/value.js';",
  );
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        paths: {
          "@/*": ["${configDir}/one/*", "${configDir}/two/*"],
        },
      },
    }),
  );
  return {
    root,
    params: nativeParams(root),
    addEarlier: () =>
      write(path.join(root, "one/value.js"), "export const value='one';"),
  };
}
