import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  inlineChangesFixture,
  inlineComponentSource,
} from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const cases = [
  {
    name: "table",
    receiver: "<table><tbody>{props.children}</tbody></table>",
    child:
      '<tr><td style={{ backgroundImage: "url(../../image.svg)" }}>Caller</td></tr>',
  },
  {
    name: "SVG",
    receiver: "<svg>{props.children}</svg>",
    child: '<image href="../../image.svg" />',
  },
];

for (const mode of ["committed", "derived"] as const)
  for (const item of cases)
    test(`${item.name} caller copies keep receiving-context provenance in ${mode}`, async (context) => {
      const source = inlineComponentSource()
        .replace(
          '<section className="pane shared">{props.children}<action.Component label="Inside" /></section>',
          item.receiver,
        )
        .replaceAll(
          '<span className="slot-content">Screen content</span><action.Component label="Slot action" />',
          item.child,
        );
      const fixture = await inlineChangesFixture(context, "", "", {
        source,
        colorSchemes: false,
        files: {
          before: { "image.svg": "before" },
          after: { "image.svg": "after" },
        },
      });
      const input = await pageFixtureInput(fixture, mode);
      if (mode === "derived") input.changedPaths = [];
      const old = await comparePageViews(input, true, false);
      const current = await comparePageViews(input);
      for (const result of current.filter(
        ({ entryId }) => entryId === "home",
      )) {
        const delivered = old.find(
          ({ path }) => path === result.path,
        )!.comparison;
        assert.equal(delivered.view.state, "changed");
        assert.deepEqual(delivered.reasons, []);
        assert.equal(result.comparison.view.state, "changed");
        assert.deepEqual(
          result.comparison.reasons,
          mode === "committed"
            ? [{ kind: "dependency", path: "mockups/image.svg" }]
            : [{ kind: "material" }],
        );
      }
    });

test("the provenance contract and checkpoint name well-formed table and SVG receiving contexts", async () => {
  const contract = await fs.readFile(
    "docs/protocol/mokly-page-analysis.md",
    "utf8",
  );
  const checkpoint = await fs.readFile(
    "docs/dev/shared-page-analysis-checkpoint.md",
    "utf8",
  );
  assert.match(
    contract,
    /well-formed[\s\S]*receiv(?:er|ing)[\s\S]*table[\s\S]*SVG/,
  );
  assert.match(checkpoint, /table[\s\S]*SVG[\s\S]*receiv(?:er|ing)/);
});
