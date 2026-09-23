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

test("reader retains variant relationships and entry-node children", async () => {
  const fixture = JSON.parse(
    await fs.readFile("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  );
  const parent = fixture.screens[0];
  const stem = parent.route.slice(0, -5);
  const variant = structuredClone(parent);
  variant.id = `${parent.id}-empty`;
  variant.title = `${parent.title}, empty`;
  variant.route = `${stem}.variants/empty.html`;
  variant.variantOf = parent.id;
  variant.useCaseIds = [];
  for (const view of variant.views) {
    const dark = view.colorScheme === "dark" ? ".dark" : "";
    view.fragmentPath = `static/${stem}.variants/empty.${view.viewport}${dark}.html`;
  }
  fixture.screens.push(variant);
  const parentNode = findFixtureNode(fixture.tree.pages, parent.id);
  assert.ok(parentNode);
  parentNode.children = [{ id: variant.id, kind: "entry" }];

  const model = readCatalogue(fixture);
  assert.equal(
    model.screens.find(({ id }) => id === variant.id)?.variantOf,
    parent.id,
  );
  assert.deepEqual(model.tree.pages, fixture.tree.pages);
});

test("reader retains an empty collection in the Pages projection", async () => {
  const fixture = JSON.parse(
    await fs.readFile("docs/protocol/fixtures/catalogue-v1.json", "utf8"),
  );
  const empty = structuredClone(fixture.collections[0]);
  empty.childIds = [];
  empty.details.description = "Retained empty folder";
  empty.id = "empty";
  empty.title = "Empty";
  fixture.collections.push(empty);
  fixture.tree.pages.unshift({
    children: [],
    id: empty.id,
    kind: "collection",
  });

  const model = readCatalogue(fixture);
  assert.deepEqual(
    model.collections.find(({ id }) => id === empty.id)?.childIds,
    [],
  );
  assert.deepEqual(model.tree.pages[0], {
    children: [],
    id: empty.id,
    kind: "collection",
  });
  assert.equal(
    model.tree.components.some(({ id }) => id === empty.id),
    false,
  );
});

interface FixtureNode {
  children?: FixtureNode[];
  id: string;
  kind: string;
}

function findFixtureNode(
  nodes: readonly FixtureNode[],
  id: string,
): FixtureNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findFixtureNode(node.children ?? [], id);
    if (nested) return nested;
  }
  return undefined;
}
