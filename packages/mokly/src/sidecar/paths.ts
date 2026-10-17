import fs from "node:fs/promises";
import path from "node:path";

import type { Plugin, PluginBuild } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { detail } from "./errors.js";
import { resolveImport, sideRequire } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { inside } from "./path-scope.js";

export interface ConsumerRequire extends NodeJS.Require {
  peerPlugin: Plugin;
  snapshot(): Record<string, string | null>;
  resolvePeer(name: string): Promise<string>;
}

/** Resolve peers from the configuration directory under this side's policy. */
export async function consumerRequire(
  params: BundleParams,
  paths: ModulePaths,
): Promise<ConsumerRequire> {
  const directory = path.resolve(
    params.sourceRoot,
    params.configurationDirectory,
  );
  if (!inside(params.sourceRoot, await fs.realpath(directory)))
    throw new Error("configuration directory is outside sourceRoot");
  const native = sideRequire(paths, path.join(directory, "package.json"));
  const peers = new Map<string, string | Error>();
  let resolver: PluginBuild | undefined;
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
    const builder = resolver;
    if (!builder) throw new Error("peer resolution requires the active bundle");
    await Promise.all(
      names.map(async (name) => {
        const resolved = await resolveImport(paths, builder, name, {
          resolveDir: directory,
          kind: "require-call",
          pluginData: "consumer-peer",
        });
        if (resolved.errors.length)
          peers.set(
            name,
            new Error(
              `could not resolve ${name} from configuration directory: ${resolved.errors.map((error) => error.text).join("; ")}`,
            ),
          );
        else {
          try {
            peers.set(name, await paths.resolve(resolved.path));
          } catch (error) {
            peers.set(name, new Error(detail(error)));
          }
        }
      }),
    );
  };
  const resolve = (name: string) => {
    const found = peers.get(name);
    if (found instanceof Error)
      throw Object.assign(found, { code: "MODULE_NOT_FOUND" });
    return found ?? native.resolve(name);
  };
  const require = ((name: string) => native(resolve(name))) as ConsumerRequire;
  const peerPlugin: Plugin = {
    name: "consumer-peers",
    setup(builder) {
      builder.onStart(async () => {
        resolver = builder;
        await load(names);
        if (params.storiesFiles.length) resolve("@storybook/react");
      });
      builder.onEnd(() => {
        resolver = undefined;
      });
    },
  };
  Object.assign(require, native, {
    peerPlugin,
    snapshot: () =>
      Object.fromEntries(
        [...peers].map(([name, value]) => [
          name,
          typeof value === "string" ? value : null,
        ]),
      ),
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
