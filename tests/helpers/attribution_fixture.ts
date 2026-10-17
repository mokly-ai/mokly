/** A review v8 result for the attribution query self-test. */

import type {
  AffectedUsageEvidence,
  ComponentUsageContext,
  ReviewEntry,
  ReviewEntryAddress,
  ReviewResult,
} from "../../packages/viewer/dist/review/types.js";

export const chip = "library/chip";
export const other = "library/other";
export const bar = "library/bar";
export const picker = "library/picker";
export const chipSheet = "static/chip.css";
export const otherSheet = "static/other.css";
const component = (path: string, title: string): ReviewEntryAddress => ({
  path,
  title,
  props: {},
  suppliedSlots: [],
});
const barContext: ComponentUsageContext = {
  kind: "component",
  entry: component(`${bar}/selected`, "Selected"),
  viewport: "mobile",
  colorScheme: "light",
};
const screenContext: ComponentUsageContext = {
  kind: "screen",
  entry: { path: "screens/home", title: "Home", props: {} },
  viewport: "desktop",
  colorScheme: "light",
};

function evidence(
  context: ComponentUsageContext,
  chain: readonly string[],
  side: "before" | "after" = "after",
): AffectedUsageEvidence {
  return {
    side,
    context,
    via: chain.map((componentId, index) => ({
      componentId,
      instanceKey: String(index).repeat(64),
    })),
  };
}

/** A record with one changed mobile view; these queries never validate it. */
function entry(
  kind: ReviewEntry["kind"],
  sides: Pick<ReviewEntry, "before" | "after">,
  reasons: ReviewEntry["reasons"],
): ReviewEntry {
  const address = (sides.after ?? sides.before)!;
  return {
    kind,
    path: address.path,
    title: address.title,
    ...sides,
    state: sides.after ? (sides.before ? "changed" : "added") : "removed",
    included: reasons.length > 0,
    reasons,
    views: [
      {
        viewport: "mobile",
        colorScheme: "light",
        state: sides.after ? (sides.before ? "changed" : "added") : "removed",
        ignoredIds: [],
      },
    ],
  };
}

export const removedOther = entry(
  "component",
  { before: component(other, "Other") },
  [{ kind: "dependency", path: otherSheet }, { kind: "removed" }],
);
/** Changes, consumers, and usage chains the attribution queries read. */
export const result: ReviewResult = {
  schemaVersion: 8,
  baseCommit: "a".repeat(40),
  entries: [
    {
      ...entry(
        "component",
        {
          before: component("library/old-chip", "Chip"),
          after: component(chip, "Chip"),
        },
        [{ kind: "dependency", path: chipSheet }, { kind: "metadata" }],
      ),
      previousPath: "library/old-chip",
    },
    {
      ...entry(
        "component",
        { before: component(bar, "Bar"), after: component(bar, "Bar") },
        [],
      ),
      variants: ["default", "other", "selected"].map((name) =>
        entry(
          "component",
          {
            before: component(`${bar}/${name}`, name),
            after: component(`${bar}/${name}`, name),
          },
          [],
        ),
      ),
    },
    removedOther,
    entry(
      "screen",
      { after: { path: "screens/home", title: "Home", props: {} } },
      [{ kind: "added" }, { kind: "dependency", path: chipSheet }],
    ),
  ],
  affected: [
    {
      changedComponentId: chip,
      consumer: { kind: "component", path: bar },
      evidence: [
        evidence(barContext, [bar, picker, chip]),
        evidence(barContext, [bar, picker, chip], "before"),
        evidence(
          { ...barContext, entry: component(`${bar}/default`, "Default") },
          [bar, chip],
        ),
        evidence(screenContext, [bar, picker, chip]),
      ],
    },
    {
      changedComponentId: other,
      consumer: { kind: "component", path: bar },
      evidence: [
        evidence({ ...barContext, entry: component(`${bar}/other`, "Other") }, [
          bar,
          other,
        ]),
      ],
    },
    {
      changedComponentId: other,
      consumer: { kind: "screen", path: "screens/unrelated" },
      evidence: [evidence(screenContext, [other])],
    },
    {
      changedComponentId: chip,
      consumer: { kind: "screen", path: "screens/second" },
      evidence: [evidence(screenContext, [chip])],
    },
    {
      changedComponentId: chip,
      consumer: { kind: "screen", path: "screens/home" },
      evidence: [evidence(screenContext, [chip])],
    },
  ],
  diagnostics: [],
};
