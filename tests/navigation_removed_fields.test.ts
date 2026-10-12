import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import { defineComponent, defineFolder, defineScreen } from "../dist/index.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { prepareWarningRegistry } from "./helpers/removed_field_registry.js";

test("folder dependency warnings use paths and do not enter descendants", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const removed = { dependencies: undefined } as Record<string, unknown>;
  const screen = defineScreen({
    path: "Root/Group/child",
    title: "Child",
    description: "Child screen",
    relatedDocs: [],
    mobile: "Mobile",
    desktop: "Desktop",
    variants: [
      {
        slug: "empty",
        title: "Empty",
        description: "Empty child",
        mobile: "Empty",
        desktop: "Empty",
      },
    ],
  });
  const prepared = prepareWarningRegistry(
    [
      defineFolder({ path: "Root", ...removed }),
      defineFolder({ path: "Root/Group", ...removed }),
      ...screen,
    ],
    await loadConfig(fixture.root),
  );
  assert.equal(prepared.entries.length, 2);
  assert.ok(
    prepared.entries.every((entry) => !Object.hasOwn(entry, "dependencies")),
  );
  assert.deepEqual(
    prepared.diagnostics.map(({ subject }) => subject),
    [
      { kind: "folder", path: "Root" },
      { kind: "folder", path: "Root/Group" },
    ],
  );
});

test("flattened component variants warn for their own removed inputs without inheritance", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const removed = {
    dependencies: undefined,
    ownedDependencies: undefined,
  } as Record<string, unknown>;
  const registration = defineComponent({
    path: "component",
    title: "Component",
    description: "Component",
    relatedDocs: [],
    propSchema: { kind: "object", properties: {} },
    render: () => "Component",
    variants: [{ ...removed, slug: "default", title: "Default", props: {} }],
  });
  const prepared = prepareWarningRegistry(
    registration.entries,
    await loadConfig(fixture.root),
  );
  assert.deepEqual(
    prepared.diagnostics.map(({ code, subject }) => [code, [subject?.path]]),
    [
      ["removed-dependencies", ["component/default"]],
      ["removed-owned-dependencies", ["component/default"]],
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
