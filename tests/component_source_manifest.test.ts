import assert from "node:assert/strict";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import { defineComponent } from "../dist/index.js";
import {
  parseHistoricalManifest,
  parseManifest,
  serializeManifest,
} from "../dist/registry/manifest.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentViews } from "./helpers/component_views.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("v5 source metadata round-trips deterministically and readers still accept its absence", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const { manifest } = await compileCatalogue(await loadConfig(fixture.root));
  assert.equal(manifest.schemaVersion, 5);
  const original = structuredClone(manifest);
  for (const view of componentViews(original))
    for (const instance of view.instances)
      Reflect.deleteProperty(instance, "source");
  for (const read of [parseManifest, parseHistoricalManifest])
    assert.deepEqual(read(original), original);
  const supplied = structuredClone(original);
  const source = { path: "entries/caller.tsx", line: 12, column: 4 };
  const instance = componentViews(supplied).flatMap(
    (view) => view.instances,
  )[0]!;
  Object.assign(instance, { source });
  for (const read of [parseManifest, parseHistoricalManifest])
    assert.deepEqual(read(supplied), supplied);
  const text = serializeManifest(supplied);
  Object.assign(instance, {
    source: { column: 4, line: 12, path: "entries/caller.tsx" },
  });
  assert.equal(serializeManifest(supplied), text);
  assert.equal(serializeManifest(parseManifest(JSON.parse(text))), text);
  assert.match(
    text,
    /"source": \{\s+"column": 4,\s+"line": 12,\s+"path": "entries\/caller.tsx"\s+\}/,
  );
  assert.ok(text.endsWith("\n"));
  for (const invalid of [
    null,
    {},
    { ...source, unexpected: true },
    { ...source, path: "/absolute.tsx" },
    { ...source, path: "../escape.tsx" },
    { ...source, path: "entries\\caller.tsx" },
    { ...source, line: 0 },
    { ...source, column: 1.5 },
  ]) {
    Object.assign(instance, { source: invalid });
    for (const read of [parseManifest, parseHistoricalManifest])
      assert.throws(() => read(supplied), /source/);
  }
});

test("authored data schemas, slots and forged manifest components reserve __moklySource", async (t) => {
  const input = {
    id: "action",
    title: "Action",
    description: "Action",
    route: "components/action.html",
    dependencies: [],
    relatedDocs: [],
    propSchema: { kind: "object" as const, properties: {} },
    render: () => null,
    variants: [{ id: "default", title: "Default", props: {} }],
  };
  assert.throws(
    () => defineComponent({ ...input, slots: ["__moklySource"] }),
    /reserved/,
  );
  assert.throws(
    () =>
      defineComponent({
        ...input,
        propSchema: {
          kind: "object",
          properties: {
            __moklySource: { schema: { kind: "string" }, optional: true },
          },
        },
      }),
    /reserved/,
  );
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const { manifest } = await compileCatalogue(await loadConfig(fixture.root));
  for (const field of ["slots", "props"] as const) {
    const forged = structuredClone(manifest);
    const component = forged.entries.find(
      (entry) => entry.kind === "component",
    )!;
    if (field === "slots")
      Object.assign(component, { slots: ["__moklySource"] });
    else
      Object.assign(component.propSchema.properties, {
        __moklySource: { schema: { kind: "string" }, optional: true },
      });
    assert.throws(() => parseManifest(forged), /reserved/);
  }
});
