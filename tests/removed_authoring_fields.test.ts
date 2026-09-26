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
const removed: Record<string, unknown> = { dependencies: undefined };

function component(input: Record<string, unknown> = {}) {
  return defineComponent({
    ...common,
    ...input,
    route: "components/example.html",
    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [{ id: "default", title: "Default", props: {} }],
  }).entry;
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
          route: "screens/example.html",
        }),
    ],
    [
      "definePage",
      () =>
        definePage({
          ...common,
          ...removed,
          route: "pages/example.html",
          render: () => "<html></html>",
        }),
    ],
    [
      "defineUseCase",
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
    ],
    [
      "defineCollection",
      () => defineCollection({ ...common, ...removed, childIds: [] }),
    ],
    ["defineComponent", () => component(removed)],
    [
      "screen",
      () =>
        defineRoot({
          path: "screens",
          children: [
            screen({ ...common, ...views, ...removed, slug: "example" }),
          ],
        }),
    ],
    [
      "page",
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
    ],
    [
      "collection",
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
    ],
    [
      "root collection",
      () =>
        defineRoot({
          path: "screens",
          collection: { ...common, ...removed },
          children: [],
        }),
    ],
    [
      "screen variant",
      () =>
        defineScreen({
          ...common,
          ...views,
          route: "screens/example.html",
          variants: [
            {
              ...common,
              ...views,
              ...removed,
              slug: "variant",
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
    [
      {
        ...component({ ownedDependencies: undefined }),
        definedIn: "entries/fixture.mockup.tsx",
      },
    ],
    config,
  );
  assert.deepEqual(
    prepared.warnings.map((warning) => warning.code),
    ["removed-owned-dependencies"],
  );
  assert.equal(Object.hasOwn(prepared.entries[0]!, "ownedDependencies"), false);
});

test("removed fields on a variant parent or root collection warn once without inheritance", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const cases = [
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
