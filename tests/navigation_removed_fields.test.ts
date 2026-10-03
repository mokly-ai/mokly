import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { defineComponent, defineRoot, folder, screen } from "../dist/index.js";
import { prepareRegistry } from "../dist/registry/prepare.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("root and folder dependencies warn once without entering their children", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const removed = { dependencies: undefined } as Record<string, unknown>;
  const definitions = defineRoot({
    ...removed,
    navPath: ["Root"],
    children: [
      folder({
        ...removed,
        title: "Group",
        children: [
          screen({
            id: "child",
            title: "Child",
            description: "Child screen",
            mobile: "Mobile",
            desktop: "Desktop",
            variants: [
              {
                id: "child-empty",
                title: "Empty",
                description: "Empty child",
                mobile: "Empty",
                desktop: "Empty",
              },
            ],
          }),
        ],
      }),
    ],
  });
  const prepared = prepareRegistry(
    definitions.map((entry) => ({
      ...entry,
      definedIn: "entries/fixture.mockup.tsx",
    })),
    await loadConfig(fixture.root),
  );
  assert.equal(prepared.entries.length, 2);
  assert.ok(
    prepared.entries.every((entry) => !Object.hasOwn(entry, "dependencies")),
  );
  assert.deepEqual(prepared.warnings.map(({ message }) => message).sort(), [
    'dependencies has been removed; ignoring it on folder "Root / Group". Delete the field.',
    'dependencies has been removed; ignoring it on root path "Root". Delete the field.',
  ]);
});

test("flattened component variants warn for their own removed inputs without inheritance", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const removed = {
    dependencies: undefined,
    ownedDependencies: undefined,
  } as Record<string, unknown>;
  const registration = defineComponent({
    id: "component",
    title: "Component",
    description: "Component",
    relatedDocs: [],
    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [
      { ...removed, id: "component-default", title: "Default", props: {} },
    ],
  });
  const prepared = prepareRegistry(
    registration.entries.map((entry) => ({
      ...entry,
      definedIn: "entries/fixture.mockup.tsx",
    })),
    await loadConfig(fixture.root),
  );
  assert.deepEqual(
    prepared.warnings.map(({ code, context }) => [code, context]),
    [
      ["removed-dependencies", ["component-default"]],
      ["removed-owned-dependencies", ["component-default"]],
    ],
  );
  assert.ok(
    prepared.entries.every(
      (entry) =>
        !Object.hasOwn(entry, "dependencies") &&
        !Object.hasOwn(entry, "ownedDependencies"),
    ),
  );
});
