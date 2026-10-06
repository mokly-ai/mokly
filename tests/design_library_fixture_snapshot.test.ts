import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { assertSameCompilation } from "./helpers/compilation_equality.js";
import { exampleCompilation } from "./helpers/example_compilation.js";
import { copyExampleSources } from "./helpers/example_sources.js";
import { repositoryRoot } from "./helpers/fixture.js";

const ROOT_DEPENDENT_FIELDS = [
  "configPath",
  "entryModules",
  "mockupsDir",
  "postcss",
  "protectedFiles",
  "renderer",
  "repoRoot",
  "resolvedFiles",
  "review",
  "roots",
];

test("an unedited example copy compiles to the shared example compilation", async (t) => {
  await fs.mkdir(path.join(repositoryRoot, ".context"), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/example-copy-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await copyExampleSources(root);
  const copied = await loadConfig(path.join(root, "examples/basic"));
  const checkout = await loadConfig(
    repositoryRoot,
    "examples/basic/mokly.config.ts",
  );

  assertSameCompilation(
    await compileCatalogue(copied),
    await exampleCompilation(),
  );

  const fields = (config: object) => config as Record<string, unknown>;
  const differing = [
    ...new Set([...Object.keys(copied), ...Object.keys(checkout)]),
  ]
    .filter(
      (field) =>
        !isDeepStrictEqual(fields(copied)[field], fields(checkout)[field]),
    )
    .sort();
  assert.deepEqual(differing, ROOT_DEPENDENT_FIELDS);
  const rebase = (value: unknown): unknown =>
    typeof value === "string"
      ? value.replaceAll(root, repositoryRoot)
      : Array.isArray(value)
        ? value.map(rebase)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([key, item]) => [
                rebase(key),
                rebase(item),
              ]),
            )
          : value;
  for (const field of differing)
    assert.equal(
      JSON.stringify(rebase(fields(copied)[field])),
      JSON.stringify(fields(checkout)[field]),
      `${field} differs by more than the copy root`,
    );
});
