import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { ESLint } from "eslint";

import { repositoryRoot } from "./helpers/fixture.js";
import { lintProbe, requireLintRule } from "./helpers/lint_config.js";

const dependencyRule = "import/no-extraneous-dependencies";
const relativeRule = "import/no-relative-packages";
const pathRule = "import/no-restricted-paths";
const uiSource = "packages/ui/src/probe/probe.tsx";

/**
 * Resolve every relative import to the file it names, existing or not. No
 * component exists under packages/ui/src yet, so this stub stands in for
 * the file system when a test needs an import of the package source.
 */
const everyFileExists = {
  interfaceVersion: 3,
  name: "every-relative-import-exists",
  resolve(source: string, file: string) {
    return source.startsWith(".")
      ? { found: true, path: path.resolve(path.dirname(file), source) }
      : { found: false };
  },
};
const stubbedEslint = new ESLint({
  cwd: repositoryRoot,
  overrideConfig: [
    {
      files: ["packages/viewer/**"],
      settings: { "import-x/resolver-next": [everyFileExists] },
    },
  ],
});

async function messages(
  source: string,
  filePath: string,
  rule: string,
  eslint?: ESLint,
) {
  const result = eslint
    ? (await eslint.lintText(source, { filePath }))[0]
    : await lintProbe(source, filePath);
  assert.ok(result, filePath);
  assert.equal(result.fatalErrorCount, 0, filePath);
  return result.messages
    .filter(({ ruleId }) => ruleId === rule)
    .map(({ message, severity }) => ({ message, severity }));
}

test("a UI component imports only the dependencies and peers its package declares", async () => {
  for (const file of [uiSource, "packages/ui/src/probe/probe.ts"])
    await requireLintRule(file, dependencyRule);
  for (const [source, name] of [
    ['import { marked } from "marked";\nvoid marked;', "marked"],
    ['import { readCatalogueIndex } from "@mokly/viewer";', "@mokly/viewer"],
    [
      'import type { CatalogueReadModel } from "@mokly/viewer";',
      "@mokly/viewer",
    ],
    ['import { VIEWER_DIRECTORY } from "@mokly/viewer/data";', "@mokly/viewer"],
  ] as const) {
    const found = await messages(source, uiSource, dependencyRule);
    assert.equal(found.length, 1, source);
    assert.equal(found[0]!.severity, 2, source);
    assert.match(found[0]!.message, new RegExp(`'${name}' should be listed`));
  }
  const allowed = [
    'import { useState } from "react";',
    'import type { ReactNode } from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { IconSvg } from "../icons/icons.js";',
  ].join("\n");
  assert.deepEqual(await messages(allowed, uiSource, dependencyRule), []);
  assert.deepEqual(
    await messages(
      'import { render } from "@testing-library/react";',
      "packages/ui/tests/probe.test.tsx",
      dependencyRule,
    ),
    [],
  );
});

test("neither package imports another package by a relative path", async () => {
  for (const [file, source] of [
    [uiSource, 'import { IconSvg } from "../../../viewer/src/shell/icons.js";'],
    [
      "packages/ui/tests/probe.test.tsx",
      'import "../../viewer/tests/marker_dom.js";',
    ],
    ["packages/viewer/src/probe.tsx", 'import "../../ui/tests/dom.js";'],
    [
      "packages/viewer/scripts/probe.mjs",
      'import "../../ui/scripts/styles.mjs";',
    ],
  ] as const) {
    await requireLintRule(file, relativeRule);
    const found = await messages(source, file, relativeRule);
    assert.equal(found.length, 1, `${file}: ${source}`);
    assert.equal(found[0]!.severity, 2, file);
  }
  for (const [file, source] of [
    ["packages/ui/tests/probe.test.tsx", 'import "./dom.js";'],
    [
      "packages/ui/tests/probe.test.ts",
      'import "../../../tests/helpers/durations.js";',
    ],
    ["packages/viewer/src/probe.tsx", 'import "./shell/icons.js";'],
    [
      "packages/viewer/tests/probe.test.ts",
      'import "../../../tests/helpers/fixture.js";',
    ],
  ] as const)
    assert.deepEqual(await messages(source, file, relativeRule), [], file);
});

test("the viewer never imports the UI package source", async () => {
  for (const [file, source] of [
    [
      "packages/viewer/src/probe.tsx",
      'import { AppearanceSelector } from "../../ui/src/appearance-selector/appearance-selector.js";',
    ],
    [
      "packages/viewer/tests/probe.test.ts",
      'import "../../ui/src/icons/icons.js";',
    ],
  ] as const) {
    await requireLintRule(file, pathRule);
    assert.deepEqual(await messages(source, file, pathRule, stubbedEslint), [
      {
        message: `Unexpected path "${source.match(/"([^"]+)"/)![1]}" imported in restricted zone. Import @mokly/ui through its published subpaths.`,
        severity: 2,
      },
    ]);
  }
  for (const source of [
    'import "./shell/icons.js";',
    'import "../../ui/dist/icons/icons.js";',
  ])
    assert.deepEqual(
      await messages(
        source,
        "packages/viewer/src/probe.tsx",
        pathRule,
        stubbedEslint,
      ),
      [],
      source,
    );
});
