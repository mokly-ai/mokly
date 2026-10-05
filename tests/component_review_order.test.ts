import assert from "node:assert/strict";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import {
  affectedConsumerOrderKey,
  parseReviewResult,
} from "../packages/viewer/dist/data.js";

import {
  classifyFixtureWithSources,
  compilationFiles,
} from "./helpers/component_fast_path.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("producer affected-consumer order is accepted for prefix-like component ids", async (t) => {
  const source = componentEntrySource({
    body: '<pane.Component><action.Component label="Nested" /><metric.Component /></pane.Component><action.Component label="Direct" /><metric.Component />',
    exports: "...action.entries, ...pane.entries, ...metric.entries,",
    extra: `const metric = defineComponent({ ...metadata,
  path: "x2", title: "Metric", description: "A metric",
  propSchema: { kind: "object", properties: {} },
  render: () => <aside className="metric-before" />,
  variants: [{ slug: "default",  title: "Default", props: {} }]
});`,
  })
    .replace('path: "action", title:', 'path: "x", title:')
    .replace('path: "pane", title:', 'path: "x-y", title:')
    .replace('to="action"', 'to="x"');
  const fixture = await componentReviewFixture(
    t,
    (value) =>
      value
        .replace(
          "<button data-viewport=",
          '<button className="action-after" data-viewport=',
        )
        .replace("<section>", '<section className="pane-after">')
        .replace("metric-before", "metric-after"),
    source,
  );
  const classified = await classifyFixtureWithSources({
    before: fixture.before.manifest,
    after: fixture.after.manifest,
    beforeFiles: compilationFiles(fixture.before),
    afterFiles: compilationFiles(fixture.after),
    config: fixture.config,
    changedPaths: fixture.changedPaths,
  });

  assert.deepEqual(
    [
      ...new Set(
        classified.result.affectedConsumers.map(
          (item) => item.changedComponentId,
        ),
      ),
    ],
    ["x", "x-y", "x2"],
  );
  assert.deepEqual(
    classified.result.affectedConsumers.map(affectedConsumerOrderKey),
    classified.result.affectedConsumers
      .map(affectedConsumerOrderKey)
      .toSorted(),
  );
  assert.deepEqual(parseReviewResult(classified.result), classified.result);
});

test("review reader rejects Changes records outside kind-and-id order", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      'title: "Action", description:',
      'title: "Primary action", description:',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.ok(result.changes.length > 1);
  const reordered = {
    ...structuredClone(result),
    changes: [...result.changes].reverse(),
  };

  assert.throws(() => parseReviewResult(reordered), /sorted and unique/);
});

test("review reader keeps baseline-only component variants after current variants", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      ', { slug: "disabled", title: "Disabled", props: { label: "Continue", disabled: true } }',
      "",
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  const component = result.components.find((entry) => entry.path === "action");
  assert.ok(component);
  assert.deepEqual(
    component.variants.map((variant) => [variant.path, Boolean(variant.after)]),
    [
      ["action/default", true],
      ["action/disabled", false],
    ],
  );
  const reordered = {
    ...structuredClone(result),
    components: result.components.map((entry) =>
      entry.path === "action"
        ? { ...entry, variants: [...entry.variants].reverse() }
        : entry,
    ),
  };

  assert.throws(() => parseReviewResult(reordered), /variant order/);
});
