import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const start = "<!--mokly-review-ignore:start:clock-->";
const end = "<!--mokly-review-ignore:end:clock-->";
const cases = [
  {
    name: "whole table",
    selector: "tbody",
    body: `${start}<table><tr><td>clock</td></tr></table>${end}`,
    matched: false,
  },
  {
    name: "some rows",
    selector: "tbody",
    body: `<table>${start}<tr><td>clock</td></tr>${end}<tr><td>visible</td></tr></table>`,
    matched: true,
  },
  {
    name: "implied tr",
    selector: "tr",
    body: `<table>${start}<td>clock</td>${end}</table>`,
    matched: false,
  },
  {
    name: "implied colgroup",
    selector: "colgroup",
    body: `<table>${start}<col>${end}</table>`,
    matched: false,
  },
  {
    name: "adoption clone",
    selector: "p > b",
    body: `${start}<b><p>clock</b>${end}visible</p>`,
    matched: false,
  },
];

for (const linked of [false, true])
  for (const item of cases)
    test(`${linked ? "linked" : "inline"} ${item.name} retains M6 ignored-subject status`, async (context) => {
      const before = `${item.selector}{color:red}`;
      const after = `${item.selector}{color:blue}`;
      const shell = (styles: string) =>
        `import { renderToStaticMarkup } from 'react-dom/server'; export default input => input.entry.path === 'home' ? '<!doctype html><html><head>${styles}</head>${item.body}</html>' : '<!doctype html><html><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
      const fixture = await inlineChangesFixture(context, "", "", {
        source: componentEntrySource({ body: "<main>Home</main>" }),
        colorSchemes: false,
        renderer: {
          before: shell(
            linked
              ? '<link rel="stylesheet" href="../../sheet.css">'
              : `<style>${before}</style>`,
          ),
          after: shell(
            linked
              ? '<link rel="stylesheet" href="../../sheet.css">'
              : `<style>${after}</style>`,
          ),
        },
        ...(linked
          ? {
              files: {
                before: { "sheet.css": before },
                after: { "sheet.css": after },
              },
            }
          : {}),
      });
      const input = await pageFixtureInput(fixture, "committed");
      const old = await comparePageViews(input, true, false);
      const current = await comparePageViews(input, false, false);
      for (const result of current.filter(
        ({ entryId }) => entryId === "home",
      )) {
        const expected = old.find(
          ({ path }) => path === result.path,
        )!.comparison;
        assert.equal(
          expected.view.state,
          item.matched ? "changed" : "unchanged",
          "M6 subject oracle",
        );
        assert.deepEqual(result.comparison.view, expected.view, result.path);
        assert.deepEqual(
          result.comparison.reasons,
          expected.reasons,
          result.path,
        );
      }
    });
