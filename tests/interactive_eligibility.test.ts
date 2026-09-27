import assert from "node:assert/strict";
import test from "node:test";

import { buildInteractiveBootstrap } from "../dist/interactive/document.js";
import {
  InteractiveViewEligibilityError,
  InteractiveViewEligibilityReason,
} from "../dist/interactive/errors.js";
import type { InteractiveSourceEntry } from "../dist/interactive/route_table.js";

const screen = entry("screen", "home") as Extract<
  InteractiveSourceEntry,
  { kind: "screen" }
>;
const component = entry("component", "panel") as Extract<
  InteractiveSourceEntry,
  { kind: "component" }
>;

interface EligibilityCase {
  entries?: readonly InteractiveSourceEntry[];
  entryId?: string;
  expected: InteractiveViewEligibilityReason;
  name: string;
  variantId?: string;
}

const cases: readonly EligibilityCase[] = [
  {
    entryId: "missing",
    expected: InteractiveViewEligibilityReason.UnknownEntry,
    name: "unknown entry",
  },
  {
    entries: [entry("collection", "home")],
    expected: InteractiveViewEligibilityReason.NotLiveKind,
    name: "non-Live kind",
  },
  {
    entries: [{ ...screen, interactive: false }],
    expected: InteractiveViewEligibilityReason.OptedOut,
    name: "opted-out entry",
  },
  {
    entries: [component],
    entryId: "panel",
    expected: InteractiveViewEligibilityReason.MissingVariant,
    name: "missing component variant",
  },
  {
    entries: [component],
    entryId: "panel",
    expected: InteractiveViewEligibilityReason.UnknownVariant,
    name: "unknown component variant",
    variantId: "missing",
  },
  {
    expected: InteractiveViewEligibilityReason.UnexpectedVariant,
    name: "unexpected screen variant",
    variantId: "default",
  },
];

for (const { entries, entryId, expected, name, variantId } of cases) {
  test(`bootstrap has a typed ${name} reason`, () => {
    assert.throws(
      () =>
        buildInteractiveBootstrap({
          catalogueSchemes: ["light"],
          colorScheme: "light",
          entries: entries ?? [screen],
          entryId: entryId ?? "home",
          generation: "generation",
          sourceRoute: "screens/home.mobile.html",
          ...(variantId ? { variantId } : {}),
          viewport: "mobile",
        }),
      (error: unknown) => {
        assert.ok(error instanceof InteractiveViewEligibilityError);
        assert.equal(error.reason, expected);
        assert.notEqual(
          (error as InteractiveViewEligibilityError & { code?: string }).code,
          "interactive-bundle",
        );
        return true;
      },
    );
  });
}

function entry(
  kind: "collection" | "component" | "screen",
  id: string,
): InteractiveSourceEntry {
  const sourceRelativePath = "entries/interactive.mockup.tsx";
  const common = {
    declaredDependencies: [],
    dependencies: [],
    description: id,
    id,
    navPath: [],
    relatedDocs: [],
    sourcePath: sourceRelativePath,
    title: id,
  };
  if (kind === "collection")
    return { ...common, childIds: [], kind: "collection" };
  if (kind === "screen")
    return {
      ...common,
      fragments: {
        desktop: `screens/${id}.desktop.html`,
        mobile: `screens/${id}.mobile.html`,
      },
      kind: "screen",
      route: `screens/${id}.html`,
      useCaseIds: [],
      viewports: ["mobile", "desktop"],
    };
  return {
    ...common,
    controls: {},
    kind: "component",
    ownedDependencies: [],
    propSchema: { kind: "object", properties: {} },
    route: `components/${id}.html`,
    slots: [],
    variants: [
      {
        componentViews: [],
        fragments: {
          desktop: `components/${id}.variants/default.desktop.html`,
          mobile: `components/${id}.variants/default.mobile.html`,
        },
        id: "default",
        props: {},
        suppliedSlots: [],
        title: "Default",
      },
    ],
    viewports: ["mobile", "desktop"],
  };
}
