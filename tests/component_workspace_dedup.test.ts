import assert from "node:assert/strict";
import { test } from "node:test";

import type { AffectedUsageEvidence } from "@mokly/viewer/data";

import { compareReview } from "../dist/review/compare.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import {
  type UsageLink,
  workspaceData,
} from "../packages/viewer/dist/shell/workspace_data.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("affected usage keeps complete serialized identity and evidence order with one serialization per link", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (result.schemaVersion !== 5) assert.fail("Expected component result");
  const retained = (path: string) => {
    const current = fixture.after.manifest.entries.find(
      (candidate) => candidate.path === path,
    );
    if (!current) assert.fail(`Expected ${path}`);
    return { ...current, path: "removed" };
  };
  const catalogue = createCatalogue(fixture.after.manifest, [
    {
      entry: retained("pane/default"),
      folderTitles: [],
      parentTitle: "Pane",
    },
    { entry: retained("home"), folderTitles: [] },
  ]);
  const entry = catalogue.byPath.get("action");
  if (entry?.kind !== "component" || "variantOf" in entry)
    assert.fail("Expected component");
  const base: UsageLink = {
    entryId: "pane/default",
    entryKind: "component",
    title: "Pane · Default",
    viewport: "desktop",
    colorScheme: "light",
    instanceKey: "action-1",
    direct: true,
    removed: false,
    comparisonEligible: true,
  };
  const distinct: UsageLink[] = [
    base,
    { ...base, viewport: "mobile" },
    { ...base, colorScheme: "dark" },
    { ...base, entryId: "action/disabled", title: "Action · Disabled" },
    { ...base, direct: false },
    { ...base, instanceKey: "action-2" },
    { ...base, entryId: "removed", removed: true },
    {
      entryId: "home",
      entryKind: "screen",
      title: "Home",
      viewport: "desktop",
      colorScheme: "light",
      instanceKey: "action-1",
      direct: true,
      removed: false,
      comparisonEligible: true,
    },
  ];
  distinct.push({
    ...distinct.at(-1)!,
    entryId: "removed",
    removed: true,
    comparisonEligible: false,
  });
  /** A removed destination is a retained record only before-side evidence reaches. */
  const evidence = (
    link: UsageLink,
    id = link.entryId,
  ): AffectedUsageEvidence => ({
    side: link.removed ? "before" : "after",
    context: {
      ...(link.entryKind === "component"
        ? { kind: "component", variantPath: link.entryId }
        : { kind: "screen" }),
      entry: { path: id, title: link.title },
      viewport: link.viewport,
      colorScheme: link.colorScheme,
    },
    via: [
      ...(link.direct ? [] : [{ componentId: "pane", instanceKey: "pane" }]),
      { componentId: "action", instanceKey: link.instanceKey },
    ],
  });
  const inputs = distinct.flatMap((link) => [evidence(link), evidence(link)]);
  const snapshot = {
    ...result,
    affectedConsumers: [
      {
        changedComponentId: entry.path,
        consumer: { kind: "component" as const, path: "pane" },
        evidence: inputs,
      },
      {
        changedComponentId: entry.path,
        consumer: { kind: "component" as const, path: "pane" },
        evidence: [...inputs].reverse().map((item) => ({
          ...item,
          side: "before" as const,
        })),
      },
      {
        changedComponentId: "unrelated",
        consumer: { kind: "component" as const, path: "pane" },
        evidence: [evidence({ ...base, title: "Not affected by Action" })],
      },
    ],
  };
  const stringify = JSON.stringify;
  const serialized: UsageLink[] = [];
  const spy = t.mock.method(JSON, "stringify", (value: unknown) => {
    if (value && typeof value === "object" && "instanceKey" in value)
      serialized.push(value as UsageLink);
    return stringify(value);
  });
  const data = workspaceData(
    catalogue,
    {
      base: "main",
      updateVersion: 1,
      componentChanges: { baseline: fixture.before.manifest, result: snapshot },
    },
    entry,
  );
  spy.mock.restore();
  assert.deepEqual(data.affected, distinct);
  assert.deepEqual(data.change, undefined);
  assert.equal(data.comparisonEligible, false);
  assert.equal(snapshot.affectedConsumers[0]!.evidence.length, inputs.length);
  assert.ok(
    serialized.length <= inputs.length * 2,
    `${serialized.length} serializations for ${inputs.length * 2} usage links`,
  );
  t.diagnostic(
    `${serialized.length} serializations for ${inputs.length * 2} usage links`,
  );
  for (const link of data.affected)
    assert.equal(
      link,
      serialized.find((item) => stringify(item) === stringify(link)),
      "Retain the first matching link object",
    );
});
