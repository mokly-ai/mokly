import assert from "node:assert/strict";
import test from "node:test";

import {
  generatedBytes,
  type GeneratedFile,
} from "../dist/build/generated_file.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { classifyComponents } from "../dist/review/component_classification.js";
import { generatedViews } from "../packages/viewer/dist/components/views.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const access of ["single", "bulk"] as const)
  test(`zero-change ${access} classification discovers each required side once`, async (t) => {
    const fixture = await componentReviewFixture(t, (source) => source);
    const events: TimingEvent[] = [];
    const reader = (outputs: ReadonlyMap<string, GeneratedFile>) => {
      const read = async (route: string) => {
        const content = outputs.get(route.replace(/^mokly-generated\//, ""));
        assert.notEqual(content, undefined, route);
        return generatedBytes(content!);
      };
      return {
        read,
        ...(access === "bulk"
          ? {
              readMany: async (routes: readonly string[]) =>
                new Map(
                  await Promise.all(
                    routes.map(
                      async (route) => [route, await read(route)] as const,
                    ),
                  ),
                ),
            }
          : {}),
      };
    };
    await runWithTimings(
      true,
      "test",
      () =>
        classifyComponents({
          before: fixture.before.manifest,
          after: fixture.after.manifest,
          beforeReader: reader(fixture.before.outputs),
          afterReader: reader(fixture.after.outputs),
          config: fixture.config,
          changedPaths: [],
          baseCommit: "a".repeat(40),
          baseRef: "main",
        }),
      { write: (event) => events.push(event) },
    );
    const views = fixture.after.manifest.entries.reduce(
      (count, entry) => count + generatedViews(entry).length,
      0,
    );
    const document = events.find(
      ({ stage, event }) =>
        stage === "review.document-work" && event === "counts",
    )!.counts!;
    assert.equal(document.htmlParses, views);
    assert.equal(document["htmlParses.pageAnalysis"], views);
    assert.ok(
      !events.some(
        ({ stage, event }) =>
          stage === "review.inline-style-analysis" && event === "start",
      ),
    );
    const counts = events.find(
      (event) =>
        event.stage === "review.compare-screens" && event.event === "counts",
    );
    assert.ok((counts?.counts?.heapPeakMiB ?? 0) > 0);
    const { heapPeakMiB: _heap, ...paths } = counts!.counts!;
    assert.deepEqual(paths, {
      views,
      fastPath: views,
      completePath: 0,
      stylePath: 0,
    });
    assert.equal(
      events.filter(
        (event) =>
          event.stage === "review.resource-graph" && event.event === "start",
      ).length,
      views * 2,
    );
    assert.equal(
      events.filter(
        (event) =>
          event.stage === "review.inline-style-analysis" &&
          event.event === "start",
      ).length,
      0,
    );
  });
