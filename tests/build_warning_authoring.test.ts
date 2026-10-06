import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  defineComponent,
  definePage,
  defineScreen,
  defineUseCase,
} from "../dist/index.js";
import { compareReview } from "../dist/review/compare.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentGit } from "./helpers/component_review_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import { prepareWarningRegistry } from "./helpers/removed_field_registry.js";

const common = {
  path: "example",
  title: "Example",
  description: "Example entry",
  relatedDocs: [],
};
const { path: _path, ...variantCommon } = common;
const views = { mobile: "Mobile", desktop: "Desktop" };
const removed = { dependencies: undefined } as Record<string, unknown>;

function component(extra: Record<string, unknown> = {}) {
  return defineComponent({
    ...common,
    ...extra,

    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [{ slug: "default", title: "Default", props: {} }],
  }).entries;
}

test("each removed authoring field emits one entry-scoped warning and no registry input", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const cases = [
    () =>
      defineScreen({
        ...common,
        ...views,
        ...removed,
      }),
    () =>
      definePage({
        ...common,
        ...removed,

        render: () => "<html></html>",
      }),
    () => [
      defineUseCase({
        ...common,
        ...removed,

        steps: [{ screenPath: "other" }],
      }),
      defineScreen({
        ...common,
        ...views,
        path: "other",

        useCasePaths: ["example"],
      }),
    ],

    () => component(removed),
  ];
  for (const create of cases) {
    const prepared = prepareWarningRegistry([create()].flat(), config);
    assert.deepEqual(prepared.warnings, [
      {
        code: "removed-dependencies",
        context: ["example"],
        message:
          'dependencies has been removed; ignoring it on entry "example". Delete the field.',
      },
    ]);
    assert.ok(
      prepared.entries.every((entry) => !Object.hasOwn(entry, "dependencies")),
    );
  }
});

test("component ownedDependencies warns without granting ownership", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const prepared = prepareWarningRegistry(
    component({ ownedDependencies: ["mockups/asset.svg"] }),
    config,
  );
  assert.deepEqual(prepared.warnings, [
    {
      code: "removed-owned-dependencies",
      context: ["example"],
      message:
        'ownedDependencies has been removed; ignoring it on component "example". Delete the field.',
    },
  ]);
  assert.ok(
    prepared.entries.every(
      (entry) => !Object.hasOwn(entry, "ownedDependencies"),
    ),
  );
  const source = componentEntrySource({
    body: '<action.Component label="Go" /><img src="../asset.svg" />',
  }).replace(
    'path: "action",',
    'path: "action", ownedDependencies: ["mockups/asset.svg"],',
  );
  await fs.writeFile(fixture.entryPath, source);
  const svg = (color: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${color}" width="10" height="10"/></svg>`;
  await fs.writeFile(path.join(fixture.mockupsDir, "asset.svg"), svg("red"));
  const before = await compileCatalogue(config);
  await fs.writeFile(path.join(fixture.mockupsDir, "asset.svg"), svg("blue"));
  const after = await compileCatalogue(config);
  const { result } = await compareReview(
    after,
    config,
    componentGit(
      before,
      ["mockups/asset.svg"],
      new Map([["mockups/asset.svg", svg("red")]]),
    ),
    "main",
  );
  assert.deepEqual(
    result.changes.map((entry) => entry.after?.path),
    ["home"],
  );
  assert.deepEqual(result.affectedConsumers, []);
  const home = after.manifest.entries.find((entry) => entry.path === "home");
  assert.ok(home?.kind === "screen");
  assert.ok(home.componentViews?.length);
  assert.ok(home.componentViews.every((view) => view.resources.length === 0));
});

test("variant parent warnings do not inherit into their children", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  for (const definitions of [
    defineScreen({
      ...common,
      ...views,
      ...removed,

      variants: [{ ...variantCommon, ...views, slug: "child" }],
    }),
  ]) {
    const prepared = prepareWarningRegistry([definitions].flat(), config);
    assert.deepEqual(
      prepared.warnings.map((warning) => warning.context),
      [["example"]],
    );
    assert.ok(
      prepared.entries.every((entry) => !Object.hasOwn(entry, "dependencies")),
    );
  }
});

test("a screen variant's own removed field warns under its own path", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const definitions = defineScreen({
    ...common,
    ...views,

    variants: [{ ...variantCommon, ...views, ...removed, slug: "child" }],
  });
  const prepared = prepareWarningRegistry([definitions].flat(), config);
  assert.deepEqual(
    prepared.warnings.map((warning) => warning.context),
    [["example/child"]],
  );
});
