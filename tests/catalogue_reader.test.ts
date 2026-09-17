import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { serializeCatalogue } from "../src/catalogue/serialization.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("readers validate known fields while additive schema, control and usage fields are tolerated", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const model = projectCatalogue({
    configPath: "mokly.config.ts",
    catalogue: createCatalogue(fixture.after.manifest),
    changesStatus: "disabled",
    comparisonUrl: null,
    revision: { content: 0, evidence: 0 },
  });
  const json = serializeCatalogue(model);
  const additive = JSON.parse(json);
  additive.components[0].propSchema.future = true;
  additive.components[0].controls.label.future = true;
  additive.screens[0].views[0].usage.instances[0].future = true;
  additive.screens[0].views[0].usage.instances[0].source.future = true;
  additive.screens[0].views[0].usage.instances[0].owner.future = true;
  additive.screens[0].views[0].usage.ranges[0].target.future = true;
  assert.deepEqual(readCatalogue(additive), model);
  const changes = [
    (value: typeof additive) => {
      const usage = value.screens[0].views[0].usage;
      const instance = usage.instances.find(
        (item: { owner: { kind: string } }) => item.owner.kind === "entry",
      );
      instance.owner.instanceKey = "e".repeat(64);
    },
    (value: typeof additive) => {
      const target = value.screens[0].views[0].usage.ranges[0].target;
      target[target.kind === "instance" ? "slotKey" : "instanceKey"] =
        "e".repeat(64);
    },
    (value: typeof additive) => {
      value.screens[0].views[0].usage.instances[0].key = "e".repeat(64);
    },
    (value: typeof additive) => {
      value.screens[0].views[0].usage.instances[0].propsKey = "f".repeat(64);
    },
    (value: typeof additive) => {
      value.screens[0].views[0].usage.instances[0].source.path =
        "/private/source.tsx";
    },
    (value: typeof additive) => {
      value.screens[0].views[0].usage.instances[0].source.line = 0;
    },
    (value: typeof additive) => {
      value.screens[0].views[0].usage.ranges[0].parentId = "r-999";
    },
    (value: typeof additive) => {
      value.components[0].variants[0].props.label = ["boolean", true];
    },
    (value: typeof additive) => {
      value.components[0].variants[0].comparison = {
        status: "ready",
        kind: "added",
        eligible: true,
      };
    },
    (value: typeof additive) => {
      value.screens[0].views[0].usage.status = "pending";
    },
    (value: typeof additive) => {
      value.identity.title = "Invented account";
    },
  ];
  for (const change of changes) {
    const value = JSON.parse(json);
    change(value);
    assert.throws(() => readCatalogue(value), String(change));
  }
  const reordered = structuredClone(fixture.after.manifest);
  for (const entry of reordered.entries) {
    const views =
      entry.kind === "screen"
        ? (entry.componentViews ?? [])
        : entry.kind === "component"
          ? entry.variants.flatMap((variant) => variant.componentViews)
          : [];
    for (const view of views) {
      view.instances = [...view.instances].reverse();
      view.slots = [...view.slots].reverse();
      view.ranges = [...view.ranges].reverse();
    }
  }
  assert.equal(
    serializeCatalogue(
      projectCatalogue({
        configPath: "mokly.config.ts",
        catalogue: createCatalogue(reordered),
        changesStatus: "disabled",
        comparisonUrl: null,
        revision: { content: 0, evidence: 0 },
      }),
    ),
    json,
  );
  reordered.entries[0]!.sourcePath = "C:/private/source.tsx";
  assert.throws(() =>
    projectCatalogue({
      configPath: "mokly.config.ts",
      catalogue: createCatalogue(reordered),
      changesStatus: "disabled",
      comparisonUrl: null,
      revision: { content: 0, evidence: 0 },
    }),
  );
});

test("public fixture rejects incomplete view axes and private nested extension paths", async () => {
  const fixture = JSON.parse(
    await fs.readFile("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  );
  fixture.screens[0].views.pop();
  assert.throws(() => readCatalogue(fixture));
  const extended = JSON.parse(
    await fs.readFile("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  );
  extended.extension = { absolutePath: "/private/file.tsx" };
  assert.throws(() => readCatalogue(extended));
});
