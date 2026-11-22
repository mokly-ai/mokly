import path from "node:path";

import type { ImportKind } from "esbuild";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";

import { fileVariants, resolutionExtensions } from "./mapped-selection.js";
import type { PhysicalInputs } from "./physical-inputs.js";

const defaultLoaders: Readonly<Record<string, string>> = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
  ".css": "css",
  ".module.css": "local-css",
  ".json": "json",
  ".txt": "text",
};

function loader(extension: string, settings: ModuleResolution) {
  for (let dot = extension.indexOf("."); dot >= 0;) {
    const suffix = extension.slice(dot);
    const configured =
      suffix === ".css" || suffix === ".module.css"
        ? undefined
        : settings.loaders[suffix];
    const value = configured ?? defaultLoaders[suffix];
    if (value !== undefined) return value;
    dot = extension.indexOf(".", dot + 1);
  }
  return undefined;
}

function extensions(
  base: string,
  kind: ImportKind,
  settings: ModuleResolution,
): readonly string[] {
  const order = resolutionExtensions(settings.resolveExtensions);
  if (kind === "import-rule" || kind === "composes-from")
    return order.filter((extension) => {
      const value = loader(extension, settings);
      return (
        value === undefined ||
        ["css", "global-css", "local-css"].includes(value)
      );
    });
  if (!base.split(path.sep).includes("node_modules")) return order;
  let split = 0;
  for (const [index, extension] of order.entries())
    if (["js", "jsx"].includes(loader(extension, settings) ?? ""))
      split = index + 1;
  if (!split) return [];
  const typescript = (extension: string) =>
    ["ts", "tsx"].includes(loader(extension, settings) ?? "");
  return [
    ...order.slice(0, split).filter((extension) => !typescript(extension)),
    ...order.filter(typescript),
    ...order.slice(split).filter((extension) => !typescript(extension)),
  ];
}

/** List one inexact folder target in native order, without resolving an import. */
export function* folderCandidateOrder(
  base: string,
  kind: ImportKind,
  settings: ModuleResolution,
  inputs: PhysicalInputs,
): Generator<string> {
  const order = extensions(base, kind, settings);
  const indexes = (directory: string) =>
    order.map((extension) => path.join(directory, "index" + extension));
  yield* fileVariants(base, order);
  const manifest = inputs.packageJson(
    path.join(base, "package.json"),
    false,
    false,
    true,
  );
  const fields = settings.mainFields.length
    ? settings.mainFields
    : ["main", "module"];
  const main = manifest?.values("main")[0];
  const implicitMain =
    !settings.mainFields.length &&
    kind === "require-call" &&
    (typeof main !== "string" || !main);
  for (const field of new Set(fields)) {
    if (field === "module" && implicitMain) yield* indexes(base);
    const value = manifest?.values(field)[0];
    if (typeof value !== "string" || !value) continue;
    const target = path.resolve(base, value);
    yield* fileVariants(target, order);
    yield* indexes(target);
  }
  yield* indexes(base);
}
