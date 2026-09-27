import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { ResolvedRegistryEntry } from "../dist/authoring/types.js";
import { buildInteractiveBootstrap } from "../dist/interactive/document.js";
import {
  InteractiveViewEligibilityError,
  InteractiveViewEligibilityReason,
} from "../dist/interactive/errors.js";

import { repositoryRoot } from "./helpers/fixture.js";

const screen = entry("screen", "home") as Extract<
  ResolvedRegistryEntry,
  { kind: "screen" }
>;
const component = entry("component", "panel") as Extract<
  ResolvedRegistryEntry,
  { kind: "component" }
>;

interface EligibilityCase {
  entries?: readonly ResolvedRegistryEntry[];
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
): ResolvedRegistryEntry {
  const sourceRelativePath = "entries/interactive.mockup.tsx";
  const common = {
    __viaDefine: true as const,
    dependencies: [],
    description: id,
    id,
    relatedDocs: [],
    sourcePath: path.join(repositoryRoot, sourceRelativePath),
    sourceRelativePath,
    title: id,
  };
  if (kind === "collection")
    return { ...common, childIds: [], kind: "collection" };
  if (kind === "screen")
    return {
      ...common,
      desktop: "Desktop",
      kind: "screen",
      mobile: "Mobile",
      route: `screens/${id}.html`,
      useCaseIds: [],
    };
  return {
    ...common,
    controls: {},
    kind: "component",
    ownedDependencies: [],
    propSchema: { kind: "object", properties: {} },
    render: () => null,
    route: `components/${id}.html`,
    slots: [],
    variants: [{ id: "default", props: {}, title: "Default" }],
  };
}
