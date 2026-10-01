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
    entries: [entry("page", "home")],
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
  kind: "component" | "page" | "screen",
  id: string,
): InteractiveSourceEntry {
  const sourceRelativePath = "entries/interactive.mockup.tsx";
  const common = {
    declaredDependencies: [],
    description: id,
    id,
    navPath: [],
    relatedDocs: [],
    sourcePath: sourceRelativePath,
    title: id,
  };
  if (kind === "page") return { ...common, kind: "page" };
  if (kind === "screen")
    return {
      ...common,
      colorSchemes: ["light"],
      kind: "screen",
      useCaseIds: [],
    };
  return {
    ...common,
    colorSchemes: ["light"],
    controls: {},
    kind: "component",
    ownedDependencies: [],
    propSchema: { kind: "object", properties: {} },
    slots: [],
  };
}
