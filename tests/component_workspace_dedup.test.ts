import assert from "node:assert/strict";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import type { AffectedUsageEvidence } from "../dist/review/component_types.js";
import { createCatalogue } from "../dist/server/catalogue.js";
import {
  type UsageLink,
  workspaceData,
} from "../dist/server/shell/workspace_data.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("affected usage keeps complete serialized identity and evidence order with one serialization per link", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  if (result.schemaVersion !== 3) assert.fail("Expected component result");
  const catalogue = createCatalogue(fixture.after.manifest);
  const entry = catalogue.byId.get("action");
  if (entry?.kind !== "component") assert.fail("Expected component");
  const base: UsageLink = {
    title: "Pane",
    route: "components/pane.html",
    variantId: "default",
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
    { ...base, variantId: "disabled" },
    { ...base, direct: false },
    { ...base, instanceKey: "action-2" },
    { ...base, title: "Previous pane title" },
    { ...base, route: "components/removed.html", removed: true },
    {
      title: "Home",
      route: "screens/home.html",
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
    route: "screens/removed.html",
    removed: true,
    comparisonEligible: false,
  });
  const evidence = (link: UsageLink): AffectedUsageEvidence => ({
    side: "after",
    context: {
      ...(link.variantId
        ? { kind: "component", variantId: link.variantId }
        : { kind: "screen" }),
      entry: { id: "consumer", title: link.title, route: link.route },
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
        changedComponentId: entry.id,
        consumer: { kind: "component" as const, id: "pane" },
        evidence: inputs,
      },
      {
        changedComponentId: entry.id,
        consumer: { kind: "component" as const, id: "pane" },
        evidence: [...inputs].reverse().map((item) => ({
          ...item,
          side: "before" as const,
        })),
      },
      {
        changedComponentId: "unrelated",
        consumer: { kind: "component" as const, id: "pane" },
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
