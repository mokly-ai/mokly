import assert from "node:assert/strict";
import { test } from "node:test";

import { compareReview } from "../dist/review/compare.js";
import { computeChangedRoutes } from "../dist/server/changed.js";

import { componentChangeCases } from "./helpers/component_change_cases.js";
import { componentEntrySource } from "./helpers/component_fixture.js";
import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const [name, change, routes] of componentChangeCases)
  test(`component Changes attribution: ${name}`, async (t) => {
    const fixture = await componentReviewFixture(t, change);
    const artifact = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.equal(artifact.result.schemaVersion, 3);
    assert.ok("changes" in artifact.result);
    const result = artifact.result as unknown as {
      changes: { after?: { route: string }; before?: { route: string } }[];
      affectedConsumers: {
        changedComponentId: string;
        consumer: { kind: string; route?: string; id?: string };
        evidence: unknown[];
      }[];
    };
    assert.deepEqual(
      result.changes.map((entry) => (entry.after ?? entry.before)!.route),
      routes,
    );
    assert.deepEqual(
      await computeChangedRoutes(fixture.config, "main", fixture.git),
      routes,
    );
    if (
      name === "component-only implementation" ||
      name === "component and screen edits"
    ) {
      assert.ok(
        result.affectedConsumers.some(
          (item) =>
            item.changedComponentId === "action" &&
            item.consumer.route === "screens/home.html" &&
            item.evidence.length > 0,
        ),
      );
    }
    if (name === "component-only implementation") {
      const current = artifact.files.get(
        "snapshots/after/screens/home.mobile.html",
      );
      assert.ok(
        typeof current === "string" && current.includes('class="new-action"'),
      );
      assert.ok(
        result.affectedConsumers.some((item) => item.consumer.id === "pane"),
      );
    }
  });

test("metadata-only component titles do not invent affected consumers", async (t) => {
  const fixture = await componentReviewFixture(t, (s) =>
    s.replace(
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
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.equal(result.changes.length, 1);
  assert.equal(result.affectedConsumers.length, 0);
});

test("an implementation edit visible only at real consumer props still identifies the component", async (t) => {
  const fixture = await componentReviewFixture(t, (s) =>
    s.replace(
      "<button data-viewport=",
      '<button className={props.label === "Finish" ? "changed" : undefined} data-viewport=',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(
    result.changes.map((entry) => entry.after!.route),
    ["components/action.html"],
  );
  assert.ok(
    result.affectedConsumers.some((entry) => entry.consumer.kind === "screen"),
  );
});

for (const adopted of [false, true])
  test(`manual ignores inside implementations retain paired adoption rules: adopted=${adopted}`, async (t) => {
    const source = componentEntrySource({
      body: '<action.Component label="Only action" />',
      actionRender: adopted
        ? "(props) => <button>{props.label}<span>Before</span></button>"
        : '(props) => <button>{props.label}<ReviewIgnore id="internal"><span>Before</span></ReviewIgnore></button>',
    });
    const fixture = await componentReviewFixture(
      t,
      (s) =>
        adopted
          ? s.replace(
              "<span>Before</span>",
              '<ReviewIgnore id="internal"><span>After</span></ReviewIgnore>',
            )
          : s.replace("<span>Before</span>", "<span>After</span>"),
      source,
    );
    const { result } = await compareReview(
      fixture.after,
      fixture.config,
      fixture.git,
      "main",
    );
    assert.equal(result.schemaVersion, 3);
    if (result.schemaVersion !== 3) return;
    assert.deepEqual(
      result.changes.map((entry) => entry.after!.route),
      adopted ? ["components/action.html"] : [],
    );
  });

test("affected-only views retain their real comparison state without entering Changes", async (t) => {
  const fixture = await componentReviewFixture(t, (source) =>
    source.replace(
      "<button data-viewport=",
      '<button className="changed" data-viewport=',
    ),
  );
  const { result } = await compareReview(
    fixture.after,
    fixture.config,
    fixture.git,
    "main",
  );
  assert.equal(result.schemaVersion, 3);
  if (result.schemaVersion !== 3) return;
  assert.deepEqual(
    result.changes.map((entry) => entry.after!.route),
    ["components/action.html"],
  );
  assert.ok(
    result.screens[0]!.views.every(
      (view) => view.state === "changed" && view.ignoredIds.length === 0,
    ),
  );
  assert.equal(
    result.components.find((entry) => entry.id === "pane")!.state,
    "changed",
  );
});
