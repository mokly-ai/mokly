import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

for (const mode of ["committed", "derived"] as const)
  for (const embedded of [false, true])
    test(`adopted body references preserve M6 page/resource results in ${mode}, embedded=${embedded}`, async (context) => {
      const fixture = await inlineChangesFixture(
        context,
        embedded ? '<iframe src="../frame.html"></iframe>' : "",
        embedded ? '<iframe src="../frame.html"></iframe>' : "",
        {
          colorSchemes: false,
          source: componentEntrySource({
            body: embedded
              ? "<main>Home</main>"
              : '<body style={{ backgroundImage: "url(../bg.svg)" }}><main>Home</main></body>',
          }),
          files: {
            before: {
              "bg.svg": "before",
              ...(embedded
                ? {
                    "frame.html":
                      '<p>implied</p><body style="background:url(bg.svg)">',
                  }
                : {}),
            },
            after: {
              "bg.svg": "after",
              ...(embedded
                ? {
                    "frame.html":
                      '<p>implied</p><body style="background:url(bg.svg)">',
                  }
                : {}),
            },
          },
        },
      );
      const input = await pageFixtureInput(fixture, mode);
      if (mode === "derived") input.changedPaths = [];
      for (const fast of [false, true]) {
        const old = await comparePageViews(input, true, fast);
        const current = await comparePageViews(input, false, fast);
        for (const result of current.filter(
          ({ entryId }) => entryId === "home",
        )) {
          const expected = old.find(
            ({ path }) => path === result.path,
          )!.comparison;
          assert.equal(expected.view.state, "changed");
          assert.deepEqual(
            expected.reasons,
            mode === "committed"
              ? [{ kind: "dependency", path: "mockups/bg.svg" }]
              : [{ kind: "material" }],
          );
          assert.deepEqual(result.comparison.view, expected.view, result.path);
          assert.deepEqual(
            result.comparison.reasons,
            expected.reasons,
            result.path,
          );
        }
      }
    });
