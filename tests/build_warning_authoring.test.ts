import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import {
  collection,
  defineCollection,
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
    route: "components/example.html",
    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [{ id: "default", title: "Default", props: {} }],
  }).entry;
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
        route: "screens/example.html",
      }),
    () =>
      definePage({
        ...common,
        ...removed,
        route: "pages/example.html",
        render: () => "<html></html>",
      }),
    () => [
      defineUseCase({
        ...common,
        ...removed,
        route: "user-flows/example.html",
        steps: [{ screenId: "other" }],
      }),
      defineScreen({
        ...common,
        ...views,
        id: "other",
        route: "screens/other.html",
        useCaseIds: ["example"],
      }),
    ],
    () => defineCollection({ ...common, ...removed, childIds: [] }),
    () => component(removed),
    () =>
      defineRoot({
        path: "screens",
        children: [
          screen({ ...common, ...views, ...removed, slug: "example" }),
        ],
      }),
    () =>
      defineRoot({
        path: "pages",
        children: [
          page({
            ...common,
            ...removed,
            slug: "example",
            render: () => "<html></html>",
          }),
        ],
      }),
    () =>
      defineRoot({
        path: "screens",
        children: [
          collection({
            ...common,
            ...removed,
            segment: "example",
            children: [],
          }),
        ],
      }),
    () =>
      defineRoot({
        path: "screens",
        collection: { ...common, ...removed },
        children: [],
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
    [
      {
        ...component({ ownedDependencies: undefined }),
        definedIn: "entries/fixture.mockup.tsx",
      },
    ],
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

test("root and variant parent warnings do not inherit into their children", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  for (const definitions of [
    defineScreen({
      ...common,
      ...views,
      ...removed,
      route: "screens/example.html",
      variants: [{ ...common, ...views, id: "child", slug: "child" }],
    }),
    defineRoot({
      collection: { ...common, ...removed },
      children: [screen({ ...common, ...views, id: "child", slug: "child" })],
      path: "screens",
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
    route: "screens/example.html",
    variants: [{ ...common, ...views, ...removed, id: "child", slug: "child" }],
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
