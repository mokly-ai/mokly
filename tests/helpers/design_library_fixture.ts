import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  compileCatalogue,
  type Compilation,
} from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";
import { classifyComponents } from "../../dist/review/component_classification.js";
import type { ReadOnlyReviewRepository } from "../../dist/review/repository.js";

import { copyExampleSources } from "./example_sources.js";
import { repositoryRoot } from "./fixture.js";
import { timeFixturePhase } from "./fixture_timing.js";

/** Copy the actual consumer so source-edit tests never mutate the working catalogue. */
export async function designLibraryFixture(
  t: { after(fn: () => Promise<void>): void },
  mode?: "committed" | "derived",
) {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/design-library-test-"),
  );
  t.after(() =>
    timeFixturePhase("design-library", "teardown", false, () =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  );
  await timeFixturePhase("design-library", "copy", false, () =>
    copyExampleSources(root),
  );
  const config = await loadConfig(path.join(root, "examples/basic"));
  if (mode) config.generatedOutput = mode;
  if (mode === "committed") delete config.review.baselineBuild;
  const before = await timeFixturePhase(
    "design-library",
    "compile",
    false,
    () => compileCatalogue(config),
  );
  const resources = new Map<string, string>();
  for (const file of await fs.readdir(config.mockupsDir, { recursive: true })) {
    if (file.endsWith(".css"))
      resources.set(
        file,
        await fs.readFile(path.join(config.mockupsDir, file), "utf8"),
      );
  }
  const originals = new Map<string, string>();
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
      if (file.startsWith("examples/basic/generated/") && file.endsWith(".css"))
        current.set(
          file.slice("examples/basic/generated/".length),
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
    const files = new Map(
      [...resources, ...before.outputs].map(([file, contents]) => [
        `examples/basic/generated/${file}`,
        contents,
      ]),
    );
    const read = async (_commit: string, file: string) => {
      const contents = files.get(file);
      assert.notEqual(contents, undefined, file);
      return Buffer.from(contents!);
    };
    return {
      evidence: {
        mergeBase: async () => "a".repeat(40),
        changedPaths: async () => changedPaths,
      },
      reader: {
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

export function snapshotReader(
  compilation: Compilation,
  resources: ReadonlyMap<string, string>,
) {
  const read = async (file: string) => {
    const value = compilation.outputs.get(file) ?? resources.get(file);
    assert.notEqual(value, undefined, file);
    return Buffer.from(value!);
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
