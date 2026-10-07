import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";

for (const mode of ["committed", "derived"] as const)
  for (const ignoredActual of [false, true])
    for (const lookalike of [
      "ignored-tag",
      "end-tag",
      "adopted-tag",
      "doctype",
    ] as const)
      test(`${mode} ${lookalike} respects the adopted token's paired region, ignored=${ignoredActual}`, async (context) => {
        const actual = '<body style="background:url(../../image.svg)">';
        const hidden = {
          "ignored-tag": `<tr title='${actual}'>`,
          "end-tag": `</div title='${actual}'>`,
          "adopted-tag": `<body title='${actual}'>`,
          doctype: `<!DOCTYPE html PUBLIC '${actual}'>`,
        }[lookalike];
        const content = ignoredActual
          ? `${hidden}${start}${actual}${end}`
          : `${start}${hidden}${end}${actual}`;
        const renderer = `import { renderToStaticMarkup } from 'react-dom/server'; export default input => input.entry.path === 'home' ? ${JSON.stringify(`<!doctype html><html><head></head><body><p>Home</p>${content}</body></html>`)} : '<!doctype html><html><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
        const fixture = await inlineChangesFixture(context, "", "", {
          colorSchemes: false,
          source: componentEntrySource({ body: "<span>Home</span>" }),
          renderer: { before: renderer, after: renderer },
          files: {
            before: { "image.svg": "before" },
            after: { "image.svg": "after" },
          },
        });
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
            assert.equal(
              expected.view.state,
              ignoredActual ? "unchanged" : "changed",
            );
            assert.deepEqual(
              expected.reasons,
              ignoredActual
                ? []
                : mode === "committed"
                  ? [{ kind: "dependency", path: "mockups/image.svg" }]
                  : [{ kind: "material" }],
            );
            assert.deepEqual(
              result.comparison.view,
              expected.view,
              result.path,
            );
            assert.deepEqual(
              result.comparison.reasons,
              expected.reasons,
              result.path,
            );
          }
        }
      });
