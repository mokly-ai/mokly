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
const removed = { dependencies: undefined };

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

test("every authoring boundary reports removed dependencies as a registry violation", async (context) => {
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
      () =>
        defineUseCase({
          ...common,
          ...removed,
          route: "user-flows/example.html",
          steps: [{ screenId: "example" }],
        }),
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
    assert.throws(
      () =>
        prepareRegistry(
          [create()].flat().map((entry) => ({
            ...entry,
            definedIn: "entries/fixture.mockup.tsx",
          })),
          config,
        ),
      (error: Error & { code?: string }) =>
        error.code === "build-invalid" &&
        error.message.includes("[removed-field] entries/fixture.mockup.tsx") &&
        error.message.includes(
          "dependencies has been removed; delete this field.",
        ),
      label,
    );
  }
});

test("component ownedDependencies reports the same typed registry violation", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.throws(
    () =>
      prepareRegistry(
        [
          {
            ...component({ ownedDependencies: undefined }),
            definedIn: "entries/fixture.mockup.tsx",
          },
        ],
        config,
      ),
    (error: Error & { code?: string }) =>
      error.code === "build-invalid" &&
      error.message.includes(
        "[removed-field] entries/fixture.mockup.tsx (example): ownedDependencies has been removed; delete this field.",
      ),
  );
});
