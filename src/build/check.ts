import fs from "node:fs";
import path from "node:path";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import type { Compilation } from "./compile.js";

/** Compare every generated path and exact byte without following output symlinks. */
export function checkCompilation(
  compilation: Compilation,
  config: ResolvedConfig,
): void {
  const actual = listGeneratedEntries(config.generatedDir);
  const missing: string[] = [];
  const stale: string[] = [];
  const prefix = toPosixPath(
    path.relative(config.mockupsDir, config.generatedDir),
  );
  for (const [route, expected] of compilation.outputs) {
    const name = `${prefix}/${route}`;
    const entry = actual.get(route);
    if (!entry) missing.push(name);
    else if (
      entry !== "file" ||
      !matchesBytes(path.join(config.generatedDir, route), expected)
    )
      stale.push(name);
  }
  const extra = [...actual.keys()]
    .filter((route) => !compilation.outputs.has(route))
    .map((route) => (route === "." ? prefix : `${prefix}/${route}`));
  if (!missing.length && !stale.length && !extra.length) return;
  const root = toPosixPath(path.relative(config.repoRoot, config.generatedDir));
  throw new MoklyError(
    "build-invalid",
    [
      "generated output does not match source:",
      formatGroup("missing generated files", missing),
      formatGroup("stale generated files", stale),
      formatGroup("extra generated files", extra),
      `Run mokly build and commit every file under ${root}/, or run git rm -r --cached -- ${root}/ and add /${root}/ to .gitignore.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function listGeneratedEntries(root: string): Map<string, "file" | "other"> {
  const entries = new Map<string, "file" | "other">();
  let rootStatus: fs.Stats;
  try {
    rootStatus = fs.lstatSync(root);
  } catch (error) {
    if (isMissing(error)) return entries;
    throw error;
  }
  if (!rootStatus.isDirectory()) {
    entries.set(".", "other");
    return entries;
  }
  function visit(directory: string): void {
    const children = fs.readdirSync(directory, { withFileTypes: true });
    if (children.length === 0 && directory !== root)
      entries.set(toPosixPath(path.relative(root, directory)), "other");
    for (const entry of children) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else
        entries.set(
          toPosixPath(path.relative(root, candidate)),
          entry.isFile() ? "file" : "other",
        );
    }
  }
  visit(root);
  return entries;
}

function matchesBytes(candidate: string, expected: string): boolean {
  try {
    const handle = fs.openSync(
      candidate,
      fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
    );
    try {
      return (
        fs.fstatSync(handle).isFile() &&
        fs.readFileSync(handle).equals(Buffer.from(expected, "utf8"))
      );
    } finally {
      fs.closeSync(handle);
    }
  } catch (error) {
    if (isMissing(error) || isSymlink(error)) return false;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isSymlink(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ELOOP";
}

function formatGroup(title: string, routes: readonly string[]): string {
  return routes.length
    ? `${title}:\n${[...routes]
        .sort()
        .map((route) => `  - ${route}`)
        .join("\n")}`
    : "";
}
