/**
 * Reader inputs that reach every record kind, and the walk that adds one
 * field a newer writer might add to each of them.
 */

import type {
  CatalogueReadModel,
  EntryDetailV1,
} from "../src/catalogue/types.js";

import { rawDetailFixtures, rawIndexFixture } from "./catalogue_v7_fixture.js";

type Raw = Record<string, unknown>;

/** Values that are user data or a map of user names, never records. */
const USER_DATA = new Set(["props", "propSchema", "before", "after"]);

/**
 * Add one unknown field to every record at every depth. User data is left
 * alone, and the `controls` map keeps its prop names while each control and
 * each select option gains the field.
 */
export function extendEverywhere(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) extendEverywhere(item);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Raw;
  for (const [key, child] of Object.entries(record)) {
    if (USER_DATA.has(key)) continue;
    if (key === "controls" && typeof child === "object" && child !== null)
      for (const control of Object.values(child)) extendEverywhere(control);
    else extendEverywhere(child);
  }
  record.later = 1;
}

/** The index fixture, live, with every control kind on the action parent. */
export function richIndex(): CatalogueReadModel {
  const index = rawIndexFixture();
  index.live = { generation: "f6".repeat(32) };
  const action = index.components.find(
    (entry) => entry.path === "components/action",
  )!;
  action.propSchema = {
    type: "object",
    additionalProperties: false,
    required: ["label"],
    properties: {
      label: { type: "string", title: "Label" },
      disabled: { type: "boolean" },
      count: { type: "integer", minimum: 0, maximum: 10, multipleOf: 2 },
      tone: { oneOf: [{ const: "calm", title: "Calm" }, { const: "loud" }] },
    },
  } as CatalogueReadModel["components"][number]["propSchema"];
  action.controls = {
    label: { kind: "text", label: "Label", maxLength: 20 },
    disabled: { kind: "boolean", description: "Turn the action off" },
    count: { kind: "number", minimum: 0, maximum: 10, step: 2 },
    tone: {
      kind: "select",
      options: [
        { label: "Calm", value: "calm" },
        { label: "loud", value: "loud" },
      ],
    },
  };
  return index;
}

const INSTANCE = "a1".repeat(32);

/** Ready usage with one instance, one slot and one range of each optional field. */
export function richUsage() {
  return {
    status: "ready" as const,
    instances: [
      {
        key: INSTANCE,
        id: "action",
        componentId: "components/action",
        owner: { kind: "entry" as const },
        order: 0,
        props: { label: ["string", "Go"] },
        propsKey: "b2".repeat(32),
        source: { path: "specs/product/browse/home.html", line: 3, column: 5 },
      },
    ],
    slots: [
      {
        key: "c3".repeat(32),
        instanceKey: INSTANCE,
        name: "icon",
        owner: { kind: "instance" as const, instanceKey: INSTANCE },
        sourceSlotKey: "d4".repeat(32),
      },
    ],
    ranges: [
      {
        id: "r-0",
        target: { kind: "instance" as const, instanceKey: INSTANCE },
      },
      {
        id: "r-1",
        target: { kind: "slot" as const, slotKey: "c3".repeat(32) },
        parentId: "r-0",
      },
    ],
  };
}

/** Every fixture detail, with records in home's usage and its workspace. */
export function richDetails(): EntryDetailV1[] {
  const fixtures = rawDetailFixtures();
  const home = fixtures.current["product/browse/home"]!;
  for (const view of home.views) {
    (view as { usage: unknown }).usage = richUsage();
    view.resourceEvidence = {
      rules: [
        {
          stylesheet: "styles/action.css",
          selector: ".action",
          status: "matched",
          owner: { kind: "component", path: "components/action" },
        },
      ],
      resources: [{ path: "assets/icon.svg", owner: { kind: "entry" } }],
    };
  }
  home.workspace!.relatedComponents = [
    { path: "components/action", title: "Action" },
  ];
  home.workspace!.inputChanges = [
    {
      instanceId: "action",
      title: "Action",
      viewport: "mobile",
      colorScheme: "light",
      variantPath: "components/action/default",
      before: { label: ["string", "Go"] },
      after: { label: ["string", "Continue"] },
    },
  ];
  const action = fixtures.current["components/action"]!;
  action.workspace!.usedBy = [
    {
      entryPath: "product/browse/home",
      entryKind: "screen",
      title: "Home",
      viewport: "mobile",
      colorScheme: "light",
      instanceKey: INSTANCE,
      direct: true,
      removed: false,
      comparisonEligible: true,
    },
  ];
  action.workspace!.affected = action.workspace!.usedBy;
  return [
    ...Object.values(fixtures.current),
    ...Object.values(fixtures.removed),
  ];
}
