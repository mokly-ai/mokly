import assert from "node:assert/strict";
import { test } from "node:test";

import {
  componentUsageTopologyEqual,
  componentUsageSignals,
  stripComponentMarkers,
} from "../dist/components/comparison_material.js";
import { projectComponentPair } from "../dist/components/comparison_projection.js";
import type { ComponentViewRecord } from "../dist/components/manifest_types.js";

test("component marker stripping removes only current valid boundaries", () => {
  const html =
    "before<!--mokly-component:start:r-0--><span>inside</span>" +
    "<!--mokly-component:end:r-0-->after";

  assert.equal(stripComponentMarkers(html), "before<span>inside</span>after");
  assert.equal(
    stripComponentMarkers("<!--mokabook-component:start:r-0-->legacy"),
    "<!--mokabook-component:start:r-0-->legacy",
  );
  assert.equal(
    stripComponentMarkers("<!--mokly-component:start:not-a-range-->forged"),
    "<!--mokly-component:start:not-a-range-->forged",
  );
});

test("component usage signals retain input changes for identical documents", () => {
  const before = componentView("before");
  const after = componentView("after");
  const html = "<html><body><button>Same output</button></body></html>";

  assert.deepEqual(componentUsageSignals(before, after), {
    inputs: true,
    structure: false,
  });
  assert.deepEqual(
    {
      inputs: projectComponentPair(html, html, before, after, "view.html")
        .inputs,
      structure: projectComponentPair(html, html, before, after, "view.html")
        .structure,
    },
    { inputs: true, structure: false },
  );
});

test("usage topology permits only entry-owned prop differences", () => {
  const before = topologyView();
  const after = replaceInstance(before, 0, {
    props: { label: ["string", "After"] },
    propsKey: "after",
  });

  assert.equal(componentUsageTopologyEqual(undefined, undefined), true);
  assert.equal(componentUsageTopologyEqual(before, undefined), false);
  assert.equal(componentUsageTopologyEqual(undefined, after), false);
  assert.equal(componentUsageTopologyEqual(before, after), true);
});

for (const [name, change] of [
  [
    "viewport",
    (view: ComponentViewRecord) => ({ ...view, viewport: "desktop" as const }),
  ],
  [
    "color scheme",
    (view: ComponentViewRecord) => ({ ...view, colorScheme: "dark" as const }),
  ],
  [
    "component id",
    (view: ComponentViewRecord) =>
      replaceInstance(view, 0, { componentId: "other" }),
  ],
  [
    "instance key",
    (view: ComponentViewRecord) => replaceInstance(view, 0, { key: "other" }),
  ],
  [
    "instance id",
    (view: ComponentViewRecord) => replaceInstance(view, 0, { id: "other" }),
  ],
  [
    "instance owner",
    (view: ComponentViewRecord) =>
      replaceInstance(view, 0, {
        owner: { kind: "instance", instanceKey: "parent" },
      }),
  ],
  [
    "instance slot",
    (view: ComponentViewRecord) =>
      replaceInstance(view, 0, { slotKey: "other-slot" }),
  ],
  [
    "instance order",
    (view: ComponentViewRecord) => replaceInstance(view, 0, { order: 2 }),
  ],
  [
    "nested props",
    (view: ComponentViewRecord) =>
      replaceInstance(view, 1, { props: { disabled: ["boolean", true] } }),
  ],
  [
    "nested props key",
    (view: ComponentViewRecord) =>
      replaceInstance(view, 1, { propsKey: "nested-after" }),
  ],
  [
    "slots",
    (view: ComponentViewRecord) => ({
      ...view,
      slots: [{ ...view.slots[0]!, name: "other" }],
    }),
  ],
  [
    "ranges",
    (view: ComponentViewRecord) => ({
      ...view,
      ranges: [{ ...view.ranges[0]!, id: "r-1" }],
    }),
  ],
  [
    "styles",
    (view: ComponentViewRecord) => ({
      ...view,
      styles: [{ ...view.styles[0]!, endOffset: 11 }],
    }),
  ],
  [
    "resources",
    (view: ComponentViewRecord) => ({
      ...view,
      resources: [{ ...view.resources[0]!, path: "other.css" }],
    }),
  ],
] as const)
  test(`usage topology rejects changed ${name}`, () => {
    const before = topologyView();
    assert.equal(componentUsageTopologyEqual(before, change(before)), false);
  });

function componentView(propsKey: string): ComponentViewRecord {
  return {
    viewport: "mobile",
    colorScheme: "light",
    instances: [
      {
        key: "action",
        id: "action",
        componentId: "action",
        owner: { kind: "entry" },
        order: 0,
        props: {},
        propsKey,
      },
    ],
    slots: [],
    ranges: [],
    styles: [],
    resources: [],
  };
}

function topologyView(): ComponentViewRecord {
  return {
    viewport: "mobile",
    colorScheme: "light",
    instances: [
      {
        key: "parent",
        id: "parent",
        componentId: "pane",
        owner: { kind: "entry" },
        order: 0,
        props: { label: ["string", "Before"] },
        propsKey: "before",
      },
      {
        key: "child",
        id: "child",
        componentId: "action",
        owner: { kind: "instance", instanceKey: "parent" },
        slotKey: "slot",
        order: 1,
        props: { disabled: ["boolean", false] },
        propsKey: "nested-before",
      },
    ],
    slots: [
      {
        key: "slot",
        instanceKey: "parent",
        name: "children",
        owner: { kind: "entry" },
      },
    ],
    ranges: [
      {
        id: "r-0",
        target: { kind: "instance", instanceKey: "parent" },
      },
    ],
    styles: [{ startOffset: 0, endOffset: 10, componentIds: ["pane"] }],
    resources: [{ path: "pane.css", componentIds: ["pane"] }],
  };
}

function replaceInstance(
  view: ComponentViewRecord,
  index: number,
  replacement: Partial<ComponentViewRecord["instances"][number]>,
): ComponentViewRecord {
  return {
    ...view,
    instances: view.instances.map((instance, current) =>
      current === index ? { ...instance, ...replacement } : instance,
    ),
  };
}
