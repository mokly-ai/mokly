import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { defineScreen } from "@mokly/mokly";
import { createElement } from "react";

import { sourceTreeViolations } from "./catalogue-policy";
import { entryExportViolations } from "./definition-policy";
import { loadDefinitions, modulePath } from "./load-catalogue";

function FixtureScreen() {
  return createElement("main", null, "Fixture");
}

function fixture(module: string, title = "Fixture", authoredPath?: string) {
  return {
    module,
    authoredPath,
    definition: {
      ...defineScreen({
        title,
        description: "Fixture",
        relatedDocs: [],
        render: () => createElement(FixtureScreen),
      }),
      path: authoredPath ?? modulePath(module),
    },
  };
}

const index = "product/account/profile/index.mockup.tsx";
const sibling = "product/account/profile/edit.mockup.tsx";

test("canonical source directories satisfy the independent structure checks", async () => {
  assert.deepEqual(sourceTreeViolations(await loadDefinitions()), []);
  assert.deepEqual(
    sourceTreeViolations([fixture(index), fixture(sibling)]),
    [],
  );
});

for (const [name, entries, message] of [
  [
    "repeated owner name",
    [fixture("product/account/profile/profile.mockup.tsx")],
    "directory owner uses index",
  ],
  [
    "index without a sibling",
    [fixture(index)],
    "index requires a sibling module",
  ],
  [
    "nested file is not a sibling",
    [fixture(index), fixture("product/account/profile/nested/edit.mockup.tsx")],
    "index requires a sibling module",
  ],
  [
    "authored path equal to the file path",
    [fixture(sibling, "Fixture", "product/account/profile/edit")],
    "authored path is forbidden",
  ],
  [
    "callback owner title",
    [
      fixture(
        "product/account/callback/index.mockup.tsx",
        "Sign-in link landing",
      ),
      fixture("product/account/callback/email-invalid.mockup.tsx"),
    ],
    "callback owner keeps its pending title",
  ],
] as const)
  test("source tree rejects " + name, () => {
    assert.ok(
      sourceTreeViolations(entries).some((problem) =>
        problem.startsWith(message),
      ),
      name,
    );
  });

test("variants do not count as sibling source modules", () => {
  const parent = fixture(index);
  const variant = {
    ...parent,
    definition: {
      ...parent.definition,
      path: "product/account/profile/empty",
      slug: "empty",
      variantOf: "product/account/profile",
    },
  };
  assert.ok(
    sourceTreeViolations([parent, variant]).some((problem) =>
      problem.startsWith("index requires a sibling module"),
    ),
  );
});

test("each entry module exports one definition, as its default export", async () => {
  const directory = resolve(import.meta.dirname, "../entries");
  const modules = readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.mockup\.(?:ts|tsx)$/.test(file))
    .sort();
  for (const module of modules) {
    const exports: Readonly<Record<string, unknown>> = await import(
      pathToFileURL(resolve(directory, module)).href
    );
    assert.deepEqual(entryExportViolations(module, exports), [], module);
  }
  const screen = fixture(sibling).definition;
  assert.deepEqual(
    entryExportViolations(sibling, { default: screen, Wrapper: FixtureScreen }),
    [],
  );
  for (const [name, exports, message] of [
    [
      "a second definition",
      { default: screen, other: screen },
      "one definition per entry module",
    ],
    [
      "an array export",
      { default: screen, mockups: [screen] },
      "one definition per entry module",
    ],
    ["no default export", { screen }, "default export is the entry definition"],
    [
      "a default that is no definition",
      { default: FixtureScreen },
      "default export is the entry definition",
    ],
  ] as const)
    assert.ok(
      entryExportViolations(sibling, exports).some((problem) =>
        problem.startsWith(message),
      ),
      name,
    );
});
