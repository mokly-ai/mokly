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
const removed = { dependencies: undefined } as Record<string, unknown>;

function component(extra: Record<string, unknown> = {}) {
  return defineComponent({
    ...common,
    ...extra,

    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [{ id: "default", title: "Default", props: {} }],
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

        steps: [{ screenId: "other" }],
      }),
      defineScreen({
        ...common,
        ...views,
        id: "other",

        useCaseIds: ["example"],
      }),
    ],

    () => component(removed),
    () =>
      defineRoot({
        children: [screen({ ...common, ...views, ...removed })],
      }),
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
  ];
  for (const create of cases) {
    const prepared = prepareRegistry(
      [create()].flat().map((entry) => ({
        ...entry,
        definedIn: "entries/fixture.mockup.tsx",
      })),
      config,
    );
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
  const prepared = prepareRegistry(
    component({ ownedDependencies: undefined }).map((entry) => ({
      ...entry,
      definedIn: "entries/fixture.mockup.tsx",
    })),
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

      variants: [{ ...common, ...views, id: "child" }],
    }),
  ]) {
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

test("a screen variant's own removed field warns under its own id", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const definitions = defineScreen({
    ...common,
    ...views,

    variants: [{ ...common, ...views, ...removed, id: "child" }],
  });
  const prepared = prepareRegistry(
    [definitions]
      .flat()
      .map((entry) => ({ ...entry, definedIn: "entries/fixture.mockup.tsx" })),
    config,
  );
  assert.deepEqual(
    prepared.warnings.map((warning) => warning.context),
    [["child"]],
  );
});
