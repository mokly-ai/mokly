import assert from "node:assert/strict";
import test from "node:test";

import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";
const cases = [
  ["tbody", `${start}<table><tr><td>clock</td></tr></table>${end}`, false],
  [
    "tbody",
    `<table>${start}<tr><td>clock</td></tr>${end}<tr><td>visible</td></tr></table>`,
    true,
  ],
  ["tr", `<table>${start}<td>clock</td>${end}</table>`, false],
  ["body", `${start}<i>clock</i>${end}<main>visible</main>`, true],
  ["p > b", `${start}<b><p>clock</b>${end}visible</p>`, false],
] as const;

for (const mode of ["committed", "derived"] as const)
  for (const [selector, body, matched] of cases)
    test(`embedded ${mode} ${selector}, matched=${matched}, preserves M6 implied/clone subjects`, async (context) => {
      const frame = `<html><head><link rel="stylesheet" href="sheet.css"></head>${body}</html>`;
      const fixture = await inlineChangesFixture(
        context,
        '<iframe src="../frame.html"></iframe>',
        '<iframe src="../frame.html"></iframe>',
        {
          colorSchemes: false,
          files: {
            before: {
              "frame.html": frame,
              "sheet.css": `${selector}{color:red}`,
            },
            after: {
              "frame.html": frame,
              "sheet.css": `${selector}{color:blue}`,
            },
          },
        },
      );
      const input = await pageFixtureInput(fixture, mode);
      const old = await comparePageViews(input, true, false);
      const current = await comparePageViews(input, false, false);
      for (const result of current.filter(
        ({ entryId }) => entryId === "home",
      )) {
        const expected = old.find(
          ({ path }) => path === result.path,
        )!.comparison;
        assert.equal(expected.view.state, matched ? "changed" : "unchanged");
        assert.deepEqual(result.comparison.view, expected.view, result.path);
        assert.deepEqual(
          result.comparison.reasons,
          expected.reasons,
          result.path,
        );
      }
    });
