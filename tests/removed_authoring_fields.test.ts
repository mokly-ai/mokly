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
const removed: Record<string, unknown> = { dependencies: undefined };

function component(input: Record<string, unknown> = {}) {
  return defineComponent({
    ...common,
    ...input,

    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [{ slug: "default", title: "Default", props: {} }],
  }).entries;
}

test("every authoring boundary warns once for removed dependencies", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const cases = [
    [
      "defineScreen",
      () =>
        defineScreen({
          ...common,
          ...views,
          ...removed,
        }),
    ],
    [
      "definePage",
      () =>
        definePage({
          ...common,
          ...removed,

          render: () => "<html></html>",
        }),
    ],
    [
      "defineUseCase",
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
    ],

    ["defineComponent", () => component(removed)],
    [
      "screen variant",
      () =>
        defineScreen({
          ...common,
          ...views,

          variants: [
            {
              ...variantCommon,
              ...views,
              ...removed,

              slug: "example-variant",
            },
          ],
        }),
    ],
  ] as const;
  for (const [label, create] of cases) {
    const definitions = [create()].flat();
    const prepared = prepareWarningRegistry(definitions, config);
    assert.deepEqual(
      prepared.warnings.map((warning) => warning.context),
      [[label === "screen variant" ? "example/example-variant" : "example"]],
      label,
    );
    assert.ok(
      prepared.entries.every((entry) => !Object.hasOwn(entry, "dependencies")),
    );
  }
});

test("component ownedDependencies warns without entering the registry", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const prepared = prepareWarningRegistry(
    component({ ownedDependencies: undefined }),
    config,
  );
  assert.deepEqual(
    prepared.warnings.map((warning) => warning.code),
    ["removed-owned-dependencies"],
  );
  assert.equal(Object.hasOwn(prepared.entries[0]!, "ownedDependencies"), false);
});

test("removed fields on a variant parent warn once without inheritance", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const cases = [
    defineScreen({
      ...common,
      ...views,
      ...removed,

      variants: [{ ...variantCommon, ...views, slug: "child" }],
    }),
  ];
  for (const definitions of cases) {
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
