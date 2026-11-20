import path from "node:path";
import type { TestContext } from "node:test";

import type { BundleParams } from "../../packages/mokly/src/generated/sidecar/BundleParams.js";

import { nativeParams, nativeRoot, write } from "./native_resolution.js";

/** Existing candidate directories keep an added file outside consumed directories. */
export async function absolutePaths(
  context: TestContext,
  mapping: "exact" | "wildcard" = "exact",
  parent?: string,
): Promise<{
  root: string;
  written: string;
  params: BundleParams;
  addEarlier(): Promise<void>;
}> {
  const root = await nativeRoot(context, parent);
  const written = path.join(root, "written.js").replaceAll("\\", "/");
  await write(path.join(root, "package.json"), "{}");
  await write(path.join(root, "one/.keep"), "");
  await write(path.join(root, "two/value.js"), "export const value='two';");
  await write(
    path.join(root, "entry.mjs"),
    `export {value} from ${JSON.stringify(written)};`,
  );
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        paths: {
          [mapping === "exact"
            ? written
            : written.replace(/written\.js$/, "*")]:
            mapping === "exact"
              ? ["./one/value.js", "./two/value.js"]
              : ["./one/*", "./two/*"],
        },
      },
    }),
  );
  if (mapping === "wildcard")
    await write(
      path.join(root, "entry.mjs"),
      `export {value} from ${JSON.stringify(written.replace(/written\.js$/, "value.js"))};`,
    );
  return {
    root,
    written,
    params: nativeParams(root),
    addEarlier: () =>
      write(path.join(root, "one/value.js"), "export const value='one';"),
  };
}
