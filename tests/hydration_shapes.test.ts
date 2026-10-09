import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "@mokly/viewer/data";

import {
  hydrationShapeKey,
  hydrationShapeSample,
} from "./helpers/hydration_shapes.js";

type Screen = Extract<ManifestEntry, { kind: "screen" }>;
type Page = Extract<ManifestEntry, { kind: "page" }>;
type Component = Exclude<
  Extract<ManifestEntry, { kind: "component" }>,
  { variantOf: string }
>;
type Variant = Extract<ManifestEntry, { kind: "component"; variantOf: string }>;
type View = Variant["componentViews"][number];
type Instance = View["instances"][number];

const common = {
  description: "An entry",
  relatedDocs: [],
  sourcePath: "specs/entries.mockup.tsx",
};

function screen(path: string, extra: Partial<Screen> = {}): Screen {
  return {
    ...common,
    colorSchemes: ["light"],
    kind: "screen",
    path,
    title: "Screen",
    useCasePaths: [],
    ...extra,
  };
}

function page(path: string): Page {
  return { ...common, kind: "page", path, title: "Page" };
}

function component(path: string, extra: Partial<Component> = {}): Component {
  return {
    ...common,
    colorSchemes: ["light"],
    controls: {},
    kind: "component",
    path,
    propSchema: { kind: "object", properties: {} },
    slots: [],
    title: "Component",
    ...extra,
  };
}

function variant(path: string, extra: Partial<Variant> = {}): Variant {
  return {
    ...common,
    colorSchemes: ["light"],
    componentViews: [],
    kind: "component",
    path,
    props: {},
    suppliedSlots: [],
    title: "Variant",
    variantOf: "fx/component",
    ...extra,
  };
}

function instance(extra: Partial<Instance> = {}): Instance {
  return {
    componentId: "fx/component",
    id: "one",
    key: "instance-key",
    order: 0,
    owner: { kind: "entry" },
    props: {},
    propsKey: "props-key",
    ...extra,
  };
}

function view(instances: readonly Instance[]): View {
  return {
    colorScheme: "light",
    instances,
    ranges: [],
    slots: [],
    viewport: "mobile",
  };
}

function shape(entry: ManifestEntry): { fields: string[] } {
  return JSON.parse(hydrationShapeKey(entry)) as { fields: string[] };
}

test("entries with one shape share the route of their first entry", () => {
  const sample = hydrationShapeSample([
    screen("fx/first"),
    component("fx/component"),
    screen("fx/second"),
  ]);
  assert.deepEqual(
    sample.map(({ entryPath, route }) => ({ entryPath, route })),
    [
      { entryPath: "fx/first", route: "fx/first/index.html" },
      { entryPath: "fx/component", route: "fx/component/index.html" },
    ],
  );
  assert.equal(sample[0]?.shape, hydrationShapeKey(screen("fx/first")));
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

test("each shape property changes the shape", () => {
  const optional = { optional: true, schema: { kind: "string" } } as const;
  const cases: readonly (readonly [string, ManifestEntry, ManifestEntry])[] = [
    ["kind", screen("fx/a"), page("fx/a")],
    ["field", screen("fx/a"), screen("fx/a", { rationale: "Why" })],
    [
      "colour schemes",
      screen("fx/a"),
      screen("fx/a", { colorSchemes: ["light", "dark"] }),
    ],
    [
      "control kind",
      component("fx/c", { controls: { a: { kind: "text" } } }),
      component("fx/c", { controls: { a: { kind: "boolean" } } }),
    ],
    [
      "control option",
      component("fx/c", { controls: { a: { kind: "number" } } }),
      component("fx/c", { controls: { a: { kind: "number", minimum: 0 } } }),
    ],
    [
      "prop schema kind",
      component("fx/c", {
        propSchema: {
          kind: "object",
          properties: { a: { schema: { kind: "string" } } },
        },
      }),
      component("fx/c", {
        propSchema: {
          kind: "object",
          properties: { a: { schema: { kind: "boolean" } } },
        },
      }),
    ],
    [
      "optional flag",
      component("fx/c", {
        propSchema: {
          kind: "object",
          properties: { a: { schema: { kind: "string" } } },
        },
      }),
      component("fx/c", {
        propSchema: { kind: "object", properties: { a: optional } },
      }),
    ],
    [
      "own wire tag",
      variant("fx/v", { props: { a: ["string", "Go"] } }),
      variant("fx/v", { props: { a: ["number", "1"] } }),
    ],
    [
      "instance wire tag",
      screen("fx/a", {
        componentViews: [view([instance({ props: { a: ["string", "Go"] } })])],
      }),
      screen("fx/a", {
        componentViews: [view([instance({ props: { a: ["boolean", true] } })])],
      }),
    ],
    [
      "instance presence",
      screen("fx/a", { componentViews: [view([])] }),
      screen("fx/a", { componentViews: [view([instance()])] }),
    ],
    [
      "slotted instance",
      screen("fx/a", { componentViews: [view([instance()])] }),
      screen("fx/a", {
        componentViews: [view([instance({ slotKey: "slot-key" })])],
      }),
    ],
  ];
  for (const [name, before, after] of cases)
    assert.notEqual(hydrationShapeKey(before), hydrationShapeKey(after), name);
});

test("empty strings, arrays and objects count as absent", () => {
  assert.equal(
    hydrationShapeKey(screen("fx/a")),
    hydrationShapeKey(
      screen("fx/a", { componentViews: [], rationale: "", tags: [] }),
    ),
  );
  assert.ok(!shape(component("fx/c")).fields.includes("controls"));
  assert.ok(
    shape(
      component("fx/c", { controls: { a: { kind: "boolean" } } }),
    ).fields.includes("controls"),
  );
});

test("a variant and its base entry have different shapes", () => {
  assert.notEqual(
    hydrationShapeKey(screen("fx/a")),
    hydrationShapeKey(screen("fx/a/b", { variantOf: "fx/a" })),
  );
});

test("the same input gives the same keys in the same order", () => {
  const entries = [screen("fx/a"), component("fx/c"), variant("fx/c/v")];
  assert.deepEqual(
    hydrationShapeSample(entries),
    hydrationShapeSample(entries),
  );
  assert.deepEqual(
    Object.keys(JSON.parse(hydrationShapeKey(screen("fx/a"))) as object),
    [
      "kind",
      "fields",
      "colorSchemes",
      "controls",
      "propSchema",
      "values",
      "instances",
      "slotted",
    ],
  );
  assert.equal(
    hydrationShapeKey(screen("fx/a", { colorSchemes: ["dark", "light"] })),
    hydrationShapeKey(screen("fx/a", { colorSchemes: ["light", "dark"] })),
  );
});
