import assert from "node:assert/strict";
import test from "node:test";

import { ESLint } from "eslint";

import { repositoryRoot } from "./helpers/fixture.js";

const eslint = new ESLint({ cwd: repositoryRoot });
const selectionMessage =
  "Select catalogue entries with entriesUnder or entriesWhere so an empty selection fails.";

async function messages(
  source: string,
  filePath = "tests/catalogue_selection_lint_probe.ts",
) {
  const [result] = await eslint.lintText(source, { filePath });
  assert.ok(result);
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages;
}

for (const [name, consequent] of [
  ["bare continue", "continue;"],
  ["braced continue", "{ continue; }"],
] as const) {
  test(`catalogue lint rejects a direct entries loop with ${name}`, async () => {
    const found = await messages(`
      export function check(manifest) {
        for (const entry of manifest.entries) {
          if (entry.kind !== "screen") ${consequent}
          void entry;
        }
      }
    `);
    assert.deepEqual(
      found.map(({ ruleId, message }) => ({ ruleId, message })),
      [{ ruleId: "no-restricted-syntax", message: selectionMessage }],
    );
  });
}

for (const method of [
  "filter",
  "flatMap",
  "find",
  "findLast",
  "findIndex",
  "some",
  "every",
]) {
  for (const comparison of ["startsWith", "endsWith"]) {
    test(`catalogue lint rejects entries.${method} with path.${comparison}`, async () => {
      const found = await messages(`
        export function check(manifest) {
          return manifest.entries.${method}(
            (entry) => entry.path.${comparison}("design/"),
          );
        }
      `);
      assert.deepEqual(
        found.map(({ ruleId, message }) => ({ ruleId, message })),
        [{ ruleId: "no-restricted-syntax", message: selectionMessage }],
      );
    });
  }
}

const allowed = [
  [
    "checked helpers",
    `
      import { assertAbsent, entriesAt, entriesUnder, entriesWhere, entryAt } from "./helpers/catalogue_selection.js";
      export function check(manifest) {
        assertAbsent(manifest, "design/missing");
        return [
          entryAt(manifest, "design/home"),
          entriesAt(manifest, ["design/home"]),
          entriesUnder(manifest, "design"),
          entriesWhere(manifest, "design screens", (entry) => entry.path.startsWith("design/")),
        ];
      }
    `,
  ],
  [
    "entries.map",
    `export function check(manifest) {
      return manifest.entries.map((entry) => entry.path.startsWith("design/"));
    }`,
  ],
  [
    "a path assertion",
    `export function check(manifest, assert) {
      for (const entry of manifest.entries) {
        assert.ok(entry.path.startsWith("design/"));
      }
    }`,
  ],
  [
    "an inner-loop continue",
    `export function check(manifest) {
      for (const entry of manifest.entries) {
        for (const view of entry.views) {
          if (!view.ready) continue;
          void view;
        }
      }
    }`,
  ],
  [
    "an Object.entries loop",
    `export function check(manifest) {
      for (const [key, entry] of Object.entries(manifest)) {
        if (!key) continue;
        void entry;
      }
    }`,
  ],
  [
    "a filter on another path field",
    `export function check(records) {
      return records.filter((record) => record.path.startsWith("design/"));
    }`,
  ],
  [
    "a sourcePath filter",
    `export function check(manifest) {
      return manifest.entries.filter((entry) => entry.sourcePath.endsWith(".tsx"));
    }`,
  ],
] as const;

for (const [name, source] of allowed) {
  test(`catalogue lint allows ${name}`, async () => {
    assert.deepEqual(await messages(source), []);
  });
}

for (const filePath of [
  "tests/helpers/catalogue_selection.ts",
  "src/catalogue_selection_lint_probe.ts",
]) {
  test(`catalogue lint excludes ${filePath}`, async () => {
    assert.deepEqual(
      await messages(
        `export function check(manifest) {
          for (const entry of manifest.entries) {
            if (entry.kind !== "screen") continue;
            void entry;
          }
          return manifest.entries.filter((entry) => entry.path.startsWith("design/"));
        }`,
        filePath,
      ),
      [],
    );
  });
}
