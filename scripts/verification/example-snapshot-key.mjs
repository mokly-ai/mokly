/** Path, source inventory, and freshness key of the example compilation snapshot. */
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

/** Repository-relative snapshot file inside the Git-ignored `.context/`. */
export const EXAMPLE_SNAPSHOT_PATH =
  ".context/verification/example-compilation.json";

/** Snapshot format version; every key includes it. */
export const EXAMPLE_SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * Authored inputs of the example compile. The key lists them through Git, and
 * the test helper `copyExampleSources` copies them.
 */
export const EXAMPLE_SOURCE_PATHS = Object.freeze([
  "examples/basic",
  "examples/imported-assets",
  "docs/protocol",
  "README.md",
]);

const BUILT_DIRECTORIES = ["dist", "packages/viewer/dist"];
const SETTINGS_FILES = ["package-lock.json", "tsconfig.json"];
const execute = promisify(execFile);

/**
 * List tracked and non-ignored untracked files under the authored inputs in
 * code-unit order. Tracked files deleted from the working tree stay listed.
 */
export async function exampleSourceFiles(repositoryRoot) {
  const { stdout } = await execute(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...EXAMPLE_SOURCE_PATHS,
    ],
    { cwd: repositoryRoot, maxBuffer: 64 * 1024 * 1024 },
  );
  return [...new Set(stdout.split("\0").filter(Boolean))].sort();
}

/**
 * Digest every input that can change the example compilation. Files are read
 * synchronously: thousands of small reads through the four-thread pool are
 * several times slower than direct reads.
 */
export async function exampleSnapshotKey(repositoryRoot) {
  const inputs = new Map();
  for (const file of [
    ...(await exampleSourceFiles(repositoryRoot)),
    ...SETTINGS_FILES,
  ])
    inputs.set(file, inputDigest(path.join(repositoryRoot, file)));
  for (const directory of BUILT_DIRECTORIES) {
    const files = builtFiles(repositoryRoot, directory);
    if (!files) inputs.set(`${directory}/`, "missing");
    else
      for (const file of files)
        inputs.set(file, inputDigest(path.join(repositoryRoot, file)));
  }
  const hash = crypto.createHash("sha256");
  hash.update(
    `mokly-example-compilation-snapshot ${EXAMPLE_SNAPSHOT_SCHEMA_VERSION}\n`,
  );
  for (const file of [...inputs.keys()].sort())
    hash.update(`${JSON.stringify([file, inputs.get(file)])}\n`);
  return hash.digest("hex");
}

function builtFiles(repositoryRoot, directory) {
  const absolute = path.join(repositoryRoot, directory);
  if (!fs.statSync(absolute, { throwIfNoEntry: false })?.isDirectory())
    return undefined;
  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(repositoryRoot, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    );
}

function inputDigest(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat?.isSymbolicLink()) return `symlink:${fs.readlinkSync(file)}`;
  if (!stat?.isFile()) return "missing";
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}
