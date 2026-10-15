import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { build } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { resolutionOptions, sideModule } from "./resolution.js";

export function logical(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

export function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export interface ConsumerRequire extends NodeJS.Require {
  resolvePeer(name: string): Promise<string>;
}

/** Resolve peers from the configuration directory under this side's policy. */
export async function consumerRequire(
  params: BundleParams,
): Promise<ConsumerRequire> {
  const directory = path.resolve(
    params.sourceRoot,
    params.configurationDirectory,
  );
  if (!inside(params.sourceRoot, await fs.realpath(directory)))
    throw new Error("configuration directory is outside sourceRoot");
  const native = createRequire(path.join(directory, "package.json"));
  const peers = new Map<string, string | Error>();
  const names = [
    "react",
    "react/package.json",
    "react/jsx-runtime",
    "react-dom",
    "react-dom/server",
    "@storybook/react",
    "@emotion/cache",
    "@emotion/server/create-instance",
  ];
  const load = async (names: string[]) => {
    await build({
      absWorkingDir: directory,
      stdin: {
        contents: names
          .map((name) => `require(${JSON.stringify(name)});`)
          .join("\n"),
        resolveDir: directory,
      },
      platform: "node",
      bundle: true,
      write: false,
      logLevel: "silent",
      ...resolutionOptions(params.sourceRoot, params.moduleResolution),
      plugins: [
        {
          name: "consumer-peers",
          setup(builder) {
            builder.onResolve({ filter: /.*/ }, async (args) => {
              if (args.pluginData === "resolved") return;
              const resolved = await builder.resolve(args.path, {
                resolveDir: directory,
                kind: "require-call",
                pluginData: "resolved",
              });
              peers.set(
                args.path,
                resolved.errors.length
                  ? new Error(
                      `could not resolve ${args.path} from ${directory}: ${resolved.errors.map((error) => error.text).join("; ")}`,
                    )
                  : await sideModule(
                      resolved.path,
                      params.sourceRoot,
                      params.repositoryRoots,
                    ),
              );
              return { path: args.path, external: true };
            });
          },
        },
      ],
    });
  };
  await load(names);
  const resolve = (name: string) => {
    const found = peers.get(name);
    if (found instanceof Error)
      throw Object.assign(found, { code: "MODULE_NOT_FOUND" });
    return found ?? native.resolve(name);
  };
  const require = ((name: string) => native(resolve(name))) as ConsumerRequire;
  Object.assign(require, native, {
    resolve,
    async resolvePeer(name: string) {
      if (!peers.has(name)) await load([name]);
      return resolve(name);
    },
  });
  return require;
}

export async function confinedFile(
  root: string,
  file: string,
): Promise<string> {
  const resolved = await fs.realpath(path.resolve(root, file));
  if (!inside(await fs.realpath(root), resolved))
    throw new Error(`source is outside sourceRoot: ${file}`);
  if (!(await fs.stat(resolved)).isFile())
    throw new Error(`source is not a regular file: ${file}`);
  return resolved;
}
