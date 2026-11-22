import assert from "node:assert/strict";
import test from "node:test";

import { completed, serve } from "./helpers/mokly_serve.js";
import { editSteps, reactEditFixture } from "./helpers/react_edit_fixture.js";
import {
  comparisonCounts,
  diagnostics,
  publication,
} from "./helpers/react_publication.js";
import { timings } from "./helpers/static_timings.js";

test("React edits preserve the complete publication of a fresh full comparison", async (context) => {
  const fixture = await reactEditFixture(context);
  const running = await serve(
    context,
    fixture.root,
    process.env,
    ["--debug-timings"],
    true,
  );
  const url = await running.ready();
  context.after(() => {
    if (!context.passed) context.diagnostic(running.output.stderr);
  });
  let revision = 0;
  let offset = 0;
  let previousRoot: string | undefined;
  let previousFreshRoot: string | undefined;
  let textReused: unknown;
  for (const step of editSteps) {
    const baseCommit = await fixture.edit(step);
    const current = await completed(url, context.signal, "home", fetch, {
      afterRevision: revision,
      ...(baseCommit === undefined ? {} : { baseCommit }),
      settledUsage: true,
      requireReady: true,
    });
    revision = current.index.revision;
    const actual = await publication(url, context.signal);
    const work = running.output.stderr.slice(offset);
    const fresh = await serve(context, fixture.root, process.env, [
      "--debug-timings",
    ]);
    try {
      const freshUrl = await fresh.ready();
      await completed(freshUrl, context.signal, "home", fetch, {
        ...(baseCommit === undefined ? {} : { baseCommit }),
        settledUsage: true,
        requireReady: true,
      });
      const expected = await publication(freshUrl, context.signal);
      assert.equal(
        actual.roots.background,
        current.index.comparisonUrl,
        "the raw root stays stable during the settled capture",
      );
      assert.notEqual(
        actual.roots.background,
        previousRoot,
        `watched root transition after ${step}`,
      );
      assert.notEqual(
        expected.roots.background,
        previousFreshRoot,
        `fresh root transition after ${step}`,
      );
      assert.equal(
        actual.roots.background === expected.roots.background,
        step === "initial",
        "only ServeEdit stages have the pre-existing salted background root",
      );
      assert.deepEqual(
        actual.content,
        expected.content,
        `complete publication after ${step}`,
      );
      context.diagnostic(
        JSON.stringify({
          step,
          backgroundRoot: actual.roots.background,
          freshBackgroundRoot: expected.roots.background,
          selectedRoots: actual.roots.selected,
          freshSelectedRoots: expected.roots.selected,
          backgroundChanged: actual.roots.background !== previousRoot,
          freshBackgroundChanged:
            expected.roots.background !== previousFreshRoot,
        }),
      );
      previousRoot = actual.roots.background;
      previousFreshRoot = expected.roots.background;
      assert.deepEqual(
        comparisonCounts(work),
        comparisonCounts(fresh.output.stderr),
        `counts after ${step}`,
      );
      assert.deepEqual(
        diagnostics(work),
        diagnostics(fresh.output.stderr),
        `warnings and diagnostics after ${step}`,
      );
      const complete = new Map(
        Object.entries(
          timings(fresh.output.stderr)
            .filter(
              (record) =>
                record.stage === "review.compare-views" &&
                record.event === "end",
            )
            .at(-1)!,
        ),
      );
      assert.equal(
        complete.get("reused"),
        0,
        "a fresh process performs the full comparison",
      );
      if (step === "text") {
        const recorded = new Map(
          Object.entries(
            timings(work)
              .filter(
                (record) =>
                  record.stage === "review.compare-views" &&
                  record.event === "end",
              )
              .at(-1)!,
          ),
        );
        textReused = recorded.get("reused");
      }
    } finally {
      await fresh.close();
    }
    context.diagnostic(`Compared complete React publication after ${step}`);
    offset = running.output.stderr.length;
  }
  assert.ok(
    typeof textReused === "number" && textReused > 0,
    "the lasting differential exercises real reuse",
  );
  await running.close();
});
