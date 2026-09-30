import assert from "node:assert/strict";
import test from "node:test";

import {
  runWithDocumentWork,
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { compareComponentViews } from "../dist/review/component_compare_views.js";
import { ComponentDependencyPolicy } from "../dist/review/component_metadata.js";
import { ComponentMaterialReader } from "../dist/review/component_resources.js";
import { ResourceComparison } from "../dist/review/resource_comparison.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("each completed real view samples heap once; a rejecting view never samples and the peak is rounded", async (testContext) => {
  const fixture = await componentReviewFixture(testContext, (source) => source);
  const views = (id: string) =>
    generatedViews(
      fixture.before.manifest.entries.find((entry) => entry.id === id)!,
    );
  const home = views("home");
  const rejected = views("action-default")[0]!;
  const failure = new Error("Rejected view reader");
  const observations = [30.111, 81.126, 65.001, 40.555];
  let samples = 0;
  let releaseFailure!: () => void;
  const completed = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  const timer = setTimeout(releaseFailure, 2000);
  fixture.beforeRemove(() => clearTimeout(timer));
  const beforeReader = new ComponentMaterialReader({
    read: async (route) => Buffer.from(fixture.before.outputs.get(route)!),
  });
  const afterReader = new ComponentMaterialReader({
    read: async (route) => {
      if (route === rejected.path) {
        await completed;
        throw failure;
      }
      return Buffer.from(fixture.after.outputs.get(route)!);
    },
  });
  const changed = new Set<string>();
  const context = {
    beforeReader,
    afterReader,
    changed,
    prefix: "mockups",
    dependencies: new ComponentDependencyPolicy(
      fixture.before.manifest,
      fixture.after.manifest,
      [],
    ),
    resources: new ResourceComparison(
      beforeReader,
      afterReader,
      changed,
      "mockups",
    ),
  };
  const pairs = [...home, rejected].map((view) => ({
    before: view,
    after: view,
  }));
  const events: TimingEvent[] = [];
  await assert.rejects(
    runWithTimings(
      true,
      "test",
      () => runWithDocumentWork(() => compareComponentViews(context, pairs)),
      {
        heapSample: () => {
          const bytes = observations[samples++]! * 1024 ** 2;
          if (samples === home.length) releaseFailure();
          return bytes;
        },
        write: (event) => events.push(event),
      },
    ),
    (error) => error === failure,
  );
  assert.equal(samples, home.length);
  const counts = events.find(
    ({ event, stage }) =>
      event === "counts" && stage === "review.compare-screens",
  )!.counts!;
  assert.deepEqual(counts, {
    views: home.length,
    fastPath: home.length,
    completePath: 0,
    heapPeakMiB: 81.13,
  });
});
