import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import {
  defineComponent,
  definePage,
  defineRoot,
  defineScreen,
  defineUseCase,
  page,
  screen,
} from "../dist/index.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

const common = {
  id: "example",
  title: "Example",
  description: "Example entry",
  relatedDocs: [],
};
const views = { mobile: "Mobile", desktop: "Desktop" };
const removed: Record<string, unknown> = { dependencies: undefined };

function component(input: Record<string, unknown> = {}) {
  return defineComponent({
    ...common,
    ...input,

    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [{ id: "default", title: "Default", props: {} }],
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

          steps: [{ screenId: "other" }],
        }),
        defineScreen({
          ...common,
          ...views,
          id: "other",

          useCaseIds: ["example"],
        }),
      ],
    ],

    ["defineComponent", () => component(removed)],
    [
      "screen",
      () =>
        defineRoot({
          children: [screen({ ...common, ...views, ...removed })],
        }),
    ],
    [
      "page",
      () =>
        defineRoot({
          children: [
            page({
              ...common,
              ...removed,

              render: () => "<html></html>",
            }),
          ],
        }),
    ],

    [
      "screen variant",
      () =>
        defineScreen({
          ...common,
          ...views,

          variants: [
            {
              ...common,
              ...views,
              ...removed,

              id: "example-variant",
            },
          ],
        }),
    ],
  ] as const;
  for (const [label, create] of cases) {
    const definitions = [create()].flat().map((entry) => ({
      ...entry,
      definedIn: "entries/fixture.mockup.tsx",
    }));
    const prepared = prepareRegistry(definitions, config);
    assert.deepEqual(
      prepared.warnings.map((warning) => warning.context),
      [[label === "screen variant" ? "example-variant" : "example"]],
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
  const prepared = prepareRegistry(
    component({ ownedDependencies: undefined }).map((entry) => ({
      ...entry,
      definedIn: "entries/fixture.mockup.tsx",
    })),
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

      variants: [{ ...common, ...views, id: "child" }],
    }),
  ];
  for (const definitions of cases) {
    const prepared = prepareRegistry(
      [definitions].flat().map((entry) => ({
        ...entry,
        definedIn: "entries/fixture.mockup.tsx",
      })),
      config,
    );
    assert.deepEqual(
      prepared.warnings.map((warning) => warning.context),
      [["example"]],
    );
    assert.ok(
      prepared.entries.every((entry) => !Object.hasOwn(entry, "dependencies")),
    );
  }
});
