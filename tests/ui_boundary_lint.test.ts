import assert from "node:assert/strict";
import test from "node:test";

import { lintProbe, requireLintRule } from "./helpers/lint_config.js";

const dependencyRule = "import/no-extraneous-dependencies";
const relativeRule = "import/no-relative-packages";
const pathRule = "import/no-restricted-paths";
const uiSource = "packages/ui/src/probe/probe.tsx";

async function messages(source: string, filePath: string, rule: string) {
  const result = await lintProbe(source, filePath);
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
    [
      uiSource,
      'import { AppearanceSelect } from "../../../viewer/src/shell/appearance.js";',
    ],
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
    ["packages/viewer/src/probe.tsx", 'import "./shell/appearance.js";'],
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
    assert.deepEqual(await messages(source, file, pathRule), [
      {
        message: `Unexpected path "${source.match(/"([^"]+)"/)![1]}" imported in restricted zone. Import @mokly/ui through its published subpaths.`,
        severity: 2,
      },
    ]);
  }
  for (const source of [
    'import "./shell/appearance.js";',
    'import "../../ui/dist/icons/icons.js";',
    'import { IconSvg } from "@mokly/ui/icons";',
  ])
    assert.deepEqual(
      await messages(source, "packages/viewer/src/probe.tsx", pathRule),
      [],
      source,
    );
});

test("a viewer import of a real package component reports both boundary rules", async () => {
  const file = "packages/viewer/src/shell/probe.tsx";
  for (const rule of [relativeRule, pathRule])
    await requireLintRule(file, rule);
  const source =
    'import { IconSvg } from "../../../ui/src/icons/icons.js";\nvoid IconSvg;\n';
  const relative = await messages(source, file, relativeRule);
  assert.equal(relative.length, 1);
  assert.equal(relative[0]!.severity, 2);
  assert.deepEqual(await messages(source, file, pathRule), [
    {
      message:
        'Unexpected path "../../../ui/src/icons/icons.js" imported in restricted zone. Import @mokly/ui through its published subpaths.',
      severity: 2,
    },
  ]);
  // The published subpath of the same component passes both rules.
  const published =
    'import { IconSvg } from "@mokly/ui/icons";\nvoid IconSvg;\n';
  for (const rule of [relativeRule, pathRule])
    assert.deepEqual(await messages(published, file, rule), [], rule);
});
