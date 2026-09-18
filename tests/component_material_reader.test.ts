import assert from "node:assert/strict";
import { test } from "node:test";

import { generatedViews } from "../dist/components/views.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { ComponentDependencyPolicy } from "../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { compareComponentView } from "../dist/review/component_view.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("prefetch retains empty files and discovers resources only when requested", async () => {
  const reads: string[] = [];
  const reader = new ComponentMaterialReader({
    readMany: async (routes) =>
      new Map(
        routes.map((route) => {
          if (route === "view.html") return [route, Buffer.alloc(0)];
          reads.push(route);
          assert.equal(route, "used.css");
          return [route, Buffer.from('@import "./used.css";')];
        }),
      ),
    read: async (route) => {
      reads.push(route);
      assert.equal(route, "used.css");
      return Buffer.from('@import "./used.css";');
    },
  });
  await reader.prefetch(["view.html"]);
  assert.equal(await reader.text("view.html"), "");
  assert.deepEqual(reads, []);
  for (let index = 0; index < 2; index++)
    assert.deepEqual(
      await reader.resources(
        "view.html",
        '<link rel="stylesheet" href="used.css"><link rel="stylesheet" href="excluded.css"><link rel="prefetch" href="hint.css">',
        (route) => route === "excluded.css",
      ),
      new Set(["used.css"]),
    );
  assert.deepEqual(reads, ["used.css"]);
});

test("prefetch rejects an omitted view instead of falling back to unvalidated bytes", async () => {
  const reader = new ComponentMaterialReader({
    readMany: async () => new Map(),
    read: async () => assert.fail("An incomplete batch must fail"),
  });
  await assert.rejects(reader.prefetch(["missing.html"]), {
    code: "review-invalid",
    message: /missing.html: batch reader omitted the file/,
  });
});

test("resource discovery caches each document and exclusion policy", async () => {
  const reader = new ComponentMaterialReader({
    read: async () => Buffer.from(""),
  });
  const events: TimingEvent[] = [];
  const html = '<link rel="stylesheet" href="used.css">';
  const excluded = (route: string) => route === "excluded.css";
  await runWithTimings(
    true,
    "test",
    async () => {
      await reader.resources("view.html", html);
      await reader.resources("view.html", html);
      await reader.resources("view.html", html, excluded);
      await reader.resources("view.html", html, excluded);
    },
    { write: (event) => events.push(event) },
  );
  assert.equal(
    events.filter(
      (event) =>
        event.stage === "review.resource-graph" && event.event === "start",
    ).length,
    2,
  );
});

test("fall-through views reuse actual discovery in derived mode", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const screen = fixture.after.manifest.entries.find(
    (entry) => entry.kind === "screen",
  );
  assert.ok(screen);
  const view = generatedViews(screen)[0];
  assert.ok(view);
  const source = fixture.after.outputs.get(view.path);
  assert.notEqual(source, undefined);
  const document = `${source}<img src="../image.svg">`;

  const discoveryCount = async (compareResourceBytes: boolean) => {
    const events: TimingEvent[] = [];
    const reader = () =>
      new ComponentMaterialReader({
        read: async (route) =>
          Buffer.from(route === view.path ? document : "same image bytes"),
      });
    const beforeReader = reader();
    const afterReader = reader();
    const comparison = await runWithTimings(
      true,
      "test",
      () =>
        compareComponentView(
          {
            beforeReader,
            afterReader,
            dependencies: new ComponentDependencyPolicy(
              fixture.before.manifest,
              fixture.after.manifest,
              [],
            ),
            changed: new Set(["mockups/image.svg"]),
            prefix: "mockups",
            resources: new ResourceComparison(
              beforeReader,
              afterReader,
              new Set(["mockups/image.svg"]),
              "mockups",
            ),
            compareResourceBytes,
          },
          view,
          view,
        ),
      { write: (event) => events.push(event) },
    );
    assert.equal(comparison.comparisonPath, "complete");
    return events.filter(
      (event) =>
        event.stage === "review.resource-graph" && event.event === "start",
    ).length;
  };

  assert.equal(await discoveryCount(false), 4);
  assert.equal(await discoveryCount(true), 4);
});
