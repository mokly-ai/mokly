/** Route repository assertion imports to runtime-derived counting modules. */
import * as legacy from "node:assert";
import * as strict from "node:assert/strict";

const countingURL = new URL("./assertion-guard-counting.mjs", import.meta.url)
  .href;
const guardPrefix = new URL("./assertion-guard", import.meta.url).href;
const targets = new Map([
  ["node:assert", "mokly-assertion:legacy"],
  ["assert", "mokly-assertion:legacy"],
  ["node:assert/strict", "mokly-assertion:strict"],
  ["assert/strict", "mokly-assertion:strict"],
]);
const nativeModules = new Map([
  ["mokly-assertion:legacy", { specifier: "node:assert", namespace: legacy }],
  [
    "mokly-assertion:strict",
    { specifier: "node:assert/strict", namespace: strict },
  ],
]);
let root;

/** Adopt the entry module's repository root, independent of the caller's cwd. */
export function initialize(data) {
  root = data.root;
}

/** Redirect assertion imports only for repository-owned callers. */
export async function resolve(specifier, context, nextResolve) {
  const target = targets.get(specifier);
  const parent = context.parentURL ?? "";
  if (
    target &&
    root &&
    parent.startsWith(root) &&
    !parent.startsWith(guardPrefix) &&
    !parent.includes("/node_modules/")
  )
    return { url: target, shortCircuit: true };
  return nextResolve(specifier, context);
}

/** Generate exports from Node itself so every supported release keeps its API. */
export async function load(url, context, nextLoad) {
  const native = nativeModules.get(url);
  if (!native) return nextLoad(url, context);
  const source = [
    `import * as native from ${JSON.stringify(native.specifier)};`,
    `import counting from ${JSON.stringify(countingURL)};`,
    "export default counting(native.default);",
  ];
  const constructors = new Set(["AssertionError", "Assert", "CallTracker"]);
  for (const name of Object.keys(native.namespace)) {
    if (name === "default") continue;
    const value = native.namespace[name];
    const expression =
      typeof value === "function" && !constructors.has(name)
        ? `counting(native[${JSON.stringify(name)}])`
        : `native[${JSON.stringify(name)}]`;
    source.push(`export const ${name} = ${expression};`);
  }
  return { format: "module", source: source.join("\n"), shortCircuit: true };
}
