import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { baselineCatalogue } from "../../dist/baseline/catalogue.js";
import {
  compileCatalogue,
  type Compilation,
} from "../../dist/build/compile.js";
import type { GeneratedFile } from "../../dist/build/generated_file.js";
import { generatedBytes } from "../../dist/build/generated_file.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { classifyComponents } from "../../dist/review/component_classification.js";
import type { ReadOnlyReviewRepository } from "../../dist/review/repository.js";

import { exampleCompilation } from "./example_compilation.js";
import { copyExampleSources } from "./example_sources.js";
import { repositoryRoot } from "./fixture.js";

/**
 * Copy the actual consumer so edits never mutate the working catalogue. The
 * unedited copy compiles to the shared example compilation, so the before
 * state reuses it.
 * Share across a file with `fileFixture((owner) => designLibraryFixture(owner))`.
 * That helper registers teardown immediately and starts setup on first use.
 * Pass `t` to `designLibraryFixture(t)` for a single test's lifetime instead.
 */
export async function designLibraryFixture(t: {
  after(fn: () => Promise<void>): void;
}) {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/design-library-test-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await copyExampleSources(root);
  const config = await loadConfig(path.join(root, "examples/basic"));
  const before = await exampleCompilation();
  const resources = new Map<string, GeneratedFile>();
  for (const file of await fs.readdir(config.mockupsDir, { recursive: true })) {
    if (file.endsWith(".css"))
      resources.set(
        file,
        await fs.readFile(path.join(config.mockupsDir, file), "utf8"),
      );
  }
  const originals = new Map<string, GeneratedFile>();
  async function edit(file: string, change: (source: string) => string) {
    const absolute = path.join(root, file);
    const source = await fs.readFile(absolute, "utf8");
    if (!originals.has(file)) originals.set(file, source);
    const changed = change(source);
    assert.notEqual(changed, source, `Edit must change ${file}`);
    await fs.writeFile(absolute, changed);
  }
  async function reset() {
    for (const [file, source] of originals)
      await fs.writeFile(path.join(root, file), source);
    originals.clear();
  }
  async function compare(after = before, changedPaths = [...originals.keys()]) {
    const current = new Map(resources);
    for (const file of changedPaths) {
      if (file.startsWith("examples/basic/") && file.endsWith(".css"))
        current.set(
          file.slice("examples/basic/".length),
          await fs.readFile(path.join(root, file), "utf8"),
        );
    }
    return classifyComponents({
      before: before.manifest,
      after: after.manifest,
      config,
      changedPaths,
      beforeReader: snapshotReader(before, resources),
      afterReader: snapshotReader(after, current),
      baseCommit: "a".repeat(40),
      baseRef: "main",
    });
  }
  const batches: string[][] = [];
  function git(changedPaths: readonly string[]): ReadOnlyReviewRepository {
    const commit = "a".repeat(40);
    const descriptor = baselineCatalogue(
      commit,
      "examples/basic",
      "generated-v9",
    );
    const files = new Map<string, GeneratedFile>([
      ...[...resources].map(
        ([file, contents]) => [`examples/basic/${file}`, contents] as const,
      ),
      ...[...before.outputs].map(
        ([file, contents]) =>
          [`examples/basic/mokly-generated/${file}`, contents] as const,
      ),
    ]);
    const read = async (_commit: string, file: string) => {
      const contents = files.get(file);
      assert.ok(contents !== undefined, file);
      return Buffer.from(contents);
    };
    return {
      descriptor,
      evidence: {
        mergeBase: async () => commit,
        changedPaths: async () => changedPaths,
      },
      reader: {
        catalogue: descriptor,
        fileExists: async (_commit, file) => files.has(file),
        fileKind: async (_commit, file) =>
          files.has(file) ? "regular" : "missing",
        readFile: async (commit, file) => (await read(commit, file)).toString(),
        readFileBytes: read,
        readFiles: async (commit, files) => {
          batches.push([...files]);
          return new Map(
            await Promise.all(
              files.map(
                async (file) =>
                  [
                    file,
                    {
                      kind: "regular" as const,
                      bytes: await read(commit, file),
                    },
                  ] as const,
              ),
            ),
          );
        },
      },
    };
  }
  return {
    root,
    config,
    before,
    resources,
    edit,
    reset,
    compare,
    git,
    batches,
    build: () => compileCatalogue(config),
    write: (compilation: Compilation) => writeCompilation(compilation, config),
  };
}

/** Read compiled documents and captured stylesheet bytes without disk reads. */
export function snapshotReader(
  compilation: Compilation,
  resources: ReadonlyMap<string, GeneratedFile>,
) {
  const read = async (file: string) => {
    const value =
      compilation.outputs.get(
        file.startsWith("mokly-generated/")
          ? file.slice("mokly-generated/".length)
          : "",
      ) ?? resources.get(file);
    assert.ok(value !== undefined, file);
    return generatedBytes(value);
  };
  return {
    read,
    readMany: async (files: readonly string[]) =>
      new Map(
        await Promise.all(
          files.map(async (file) => [file, await read(file)] as const),
        ),
      ),
  };
}
