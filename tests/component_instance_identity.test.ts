import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  instanceKey,
  slotKey,
} from "../packages/viewer/dist/components/keys.js";
import type { ComponentInputOwner } from "../packages/viewer/dist/components/manifest_types.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { screenView } from "./helpers/component_views.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("instance and slot digests retain the frozen UTF-8 JSON preimages", () => {
  const owner: ComponentInputOwner = {
    kind: "instance",
    instanceKey: "a".repeat(64),
  };
  const slot = slotKey(owner.instanceKey, "children");
  const digest = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
  assert.equal(
    slot,
    digest(["mokabook-slot-v1", owner.instanceKey, "children"]),
  );
  assert.equal(
    instanceKey(owner, slot, "child"),
    digest([
      "mokabook-instance-v1",
      "instance",
      owner.instanceKey,
      slot,
      "child",
    ]),
  );
  assert.equal(
    instanceKey({ kind: "entry" }, undefined, "child"),
    digest(["mokabook-instance-v1", "entry", null, null, "child"]),
  );
});

const first = '<action.Component moklyInstance="first" label="One" />';
const second = '<action.Component moklyInstance="second" label="Two" />';

for (const [name, body, paneRender, retained] of [
  ["prop edit", first.replace("One", "Changed") + second, undefined, true],
  ["sibling reorder", second + first, undefined, true],
  ["id edit", first.replace('"first"', '"renamed"') + second, undefined, false],
  [
    "slot re-parenting",
    `<pane.Component>${first}</pane.Component>`,
    undefined,
    false,
  ],
  [
    "input owner re-parenting",
    "<pane.Component />",
    `() => <section>${first}</section>`,
    false,
  ],
] as const)
  test(`rendered instance key stability: ${name}`, async (t) => {
    const fixture = await createFixture(
      componentEntrySource({ body: first + second }),
    );
    t.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const before = screenView(await compileCatalogue(config)).instances.find(
      (instance) => instance.id === "first",
    )!;
    await fs.writeFile(
      fixture.entryPath,
      componentEntrySource({ body, ...(paneRender ? { paneRender } : {}) }),
    );
    const after = screenView(await compileCatalogue(config)).instances.find(
      (instance) => instance.id === (name === "id edit" ? "renamed" : "first"),
    )!;
    assert.equal(after.key === before.key, retained);
    if (name === "prop edit") assert.notEqual(after.propsKey, before.propsKey);
    if (name === "sibling reorder") assert.notEqual(after.order, before.order);
  });

test("changing an ancestor or original slot changes its descendant key", () => {
  const parent = instanceKey({ kind: "entry" }, undefined, "parent");
  const renamed = instanceKey({ kind: "entry" }, undefined, "renamed");
  const child = (key: string) =>
    instanceKey({ kind: "instance", instanceKey: key }, undefined, "child");
  assert.notEqual(child(parent), child(renamed));
  assert.notEqual(
    instanceKey({ kind: "entry" }, slotKey(parent, "children"), "child"),
    instanceKey({ kind: "entry" }, slotKey(parent, "footer"), "child"),
  );
});
