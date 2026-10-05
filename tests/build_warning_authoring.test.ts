import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import {
  defineComponent,
  definePage,
  defineScreen,
  defineUseCase,
} from "../dist/index.js";

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
    component({ ownedDependencies: undefined }),
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
