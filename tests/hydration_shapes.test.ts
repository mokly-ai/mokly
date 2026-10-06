import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "@mokly/viewer/data";

import {
  component,
  instance,
  markdownDocument,
  reverseKeys,
  screen,
  variant,
  view,
} from "./helpers/hydration_shape_entries.js";
import {
  hydrationShapeKey,
  hydrationShapeSample,
} from "./helpers/hydration_shapes.js";

const PROPERTIES = [
  "kind",
  "fields",
  "colorSchemes",
  "controls",
  "propSchema",
  "values",
  "instances",
  "slotted",
] as const;
type ShapeProperty = (typeof PROPERTIES)[number];

/** The shape properties whose values differ between two entries. */
function changedProperties(
  before: ManifestEntry,
  after: ManifestEntry,
): ShapeProperty[] {
  const parse = (entry: ManifestEntry) =>
    JSON.parse(hydrationShapeKey(entry)) as Record<ShapeProperty, unknown>;
  const [left, right] = [parse(before), parse(after)];
  return PROPERTIES.filter(
    (property) =>
      JSON.stringify(left[property]) !== JSON.stringify(right[property]),
  );
}

test("the sample keeps the first entry of each shape, once", () => {
  const entries = [
    screen("fx/first"),
    component("fx/component"),
    screen("fx/second"),
    markdownDocument("fx/doc"),
    component("fx/other"),
  ];
  const sample = hydrationShapeSample(entries);
  assert.deepEqual(
    sample.map(({ entryPath, route }) => ({ entryPath, route })),
    [
      { entryPath: "fx/first", route: "fx/first/index.html" },
      { entryPath: "fx/component", route: "fx/component/index.html" },
      { entryPath: "fx/doc", route: "fx/doc/index.html" },
    ],
  );
  assert.deepEqual(
    sample.map(({ shape }) => shape),
    [...new Set(entries.map(hydrationShapeKey))],
  );
});

test("text-only changes keep the shape", () => {
  assert.equal(
    hydrationShapeKey(screen("fx/one")),
    hydrationShapeKey(
      screen("fx/two/three", {
        description: "Another description",
        sourcePath: "specs/other.mockup.tsx",
        title: "Another title",
      }),
    ),
  );
});

test("each shape property changes the shape on its own", () => {
  const props = (kind: "string" | "boolean", optional?: true) => ({
    kind: "object" as const,
    properties: { a: { schema: { kind }, ...(optional ? { optional } : {}) } },
  });
  const cases: readonly (readonly [
    ShapeProperty,
    string,
    ManifestEntry,
    ManifestEntry,
  ])[] = [
    ["kind", "a document", screen("fx/a"), markdownDocument("fx/a")],
    [
      "fields",
      "a rationale",
      screen("fx/a"),
      screen("fx/a", { rationale: "Why" }),
    ],
    [
      "fields",
      "a parent",
      screen("fx/a"),
      screen("fx/a/b", { variantOf: "fx/a" }),
    ],
    [
      "colorSchemes",
      "a dark scheme",
      screen("fx/a"),
      screen("fx/a", { colorSchemes: ["light", "dark"] }),
    ],
    [
      "controls",
      "a control kind",
      component("fx/c", { controls: { a: { kind: "text" } } }),
      component("fx/c", { controls: { a: { kind: "boolean" } } }),
    ],
    [
      "controls",
      "a control option",
      component("fx/c", { controls: { a: { kind: "number" } } }),
      component("fx/c", { controls: { a: { kind: "number", minimum: 0 } } }),
    ],
    [
      "propSchema",
      "a prop kind",
      component("fx/c", { propSchema: props("string") }),
      component("fx/c", { propSchema: props("boolean") }),
    ],
    [
      "propSchema",
      "an optional prop",
      component("fx/c", { propSchema: props("string") }),
      component("fx/c", { propSchema: props("string", true) }),
    ],
    [
      "values",
      "an own wire tag",
      variant("fx/v", { props: { a: ["string", "Go"] } }),
      variant("fx/v", { props: { a: ["number", "1"] } }),
    ],
    [
      "values",
      "an instance wire tag",
      screen("fx/a", {
        componentViews: [view([instance({ props: { a: ["string", "Go"] } })])],
      }),
      screen("fx/a", {
        componentViews: [view([instance({ props: { a: ["boolean", true] } })])],
      }),
    ],
    [
      "instances",
      "an instance",
      screen("fx/a", { componentViews: [view([])] }),
      screen("fx/a", { componentViews: [view([instance()])] }),
    ],
    [
      "slotted",
      "a slot",
      screen("fx/a", { componentViews: [view([instance()])] }),
      screen("fx/a", {
        componentViews: [view([instance({ slotKey: "slot-key" })])],
      }),
    ],
  ];
  for (const [property, change, before, after] of cases)
    assert.deepEqual(changedProperties(before, after), [property], change);
  assert.deepEqual(
    [...new Set(cases.map(([property]) => property))].sort(),
    [...PROPERTIES].sort(),
    "every shape property needs a case",
  );
});

test("empty strings, arrays and objects count as absent", () => {
  assert.equal(
    hydrationShapeKey(screen("fx/a")),
    hydrationShapeKey(
      screen("fx/a", { componentViews: [], rationale: "", tags: [] }),
    ),
  );
  assert.deepEqual(
    changedProperties(
      component("fx/c"),
      component("fx/c", { controls: { a: { kind: "boolean" } } }),
    ),
    ["fields", "controls"],
  );
});

test("reordered properties, controls, props and instances keep the shape", () => {
  const parent = component("fx/c", {
    colorSchemes: ["light", "dark"],
    controls: {
      a: { kind: "text", maxLength: 9 },
      b: { kind: "number", minimum: 0, maximum: 5 },
      c: { kind: "boolean" },
    },
    propSchema: {
      kind: "object",
      properties: {
        a: { schema: { kind: "string" } },
        b: { optional: true, schema: { kind: "number" } },
        c: { schema: { kind: "boolean" } },
      },
    },
    tags: ["one", "two"],
  });
  const views = [
    view([
      instance({ props: { a: ["string", "Go"], b: ["number", "1"] } }),
      instance({ props: { c: ["boolean", true] }, slotKey: "slot-key" }),
    ]),
    view([instance({ props: { d: ["null"] } })]),
  ];
  const owner = screen("fx/s", { componentViews: views });
  const reordered: readonly (readonly [ManifestEntry, ManifestEntry])[] = [
    [
      parent,
      reverseKeys({ ...parent, colorSchemes: ["dark", "light"] as const }),
    ],
    [
      owner,
      reverseKeys({
        ...owner,
        componentViews: [...views]
          .reverse()
          .map((item) => ({
            ...item,
            instances: [...item.instances].reverse(),
          })),
      }),
    ],
    [
      variant("fx/v", {
        props: { a: ["string", "Go"], b: ["array", []], c: ["object", []] },
      }),
      reverseKeys(
        variant("fx/v", {
          props: { a: ["string", "Go"], b: ["array", []], c: ["object", []] },
        }),
      ),
    ],
  ];
  for (const [before, after] of reordered) {
    assert.notEqual(JSON.stringify(before), JSON.stringify(after));
    assert.equal(hydrationShapeKey(before), hydrationShapeKey(after));
  }
});

test("the key lists its properties in a fixed order", () => {
  assert.deepEqual(
    Object.keys(JSON.parse(hydrationShapeKey(screen("fx/a"))) as object),
    [...PROPERTIES],
  );
});
