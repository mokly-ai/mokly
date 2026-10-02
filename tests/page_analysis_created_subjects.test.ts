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
    name: "React p/div",
    selector: "p",
    body: "<p><div>12:00</div></p>",
    jsx: '<ReviewIgnore id="clock"><p><div>12:00</div></p></ReviewIgnore><span>Home</span>',
  },
  { name: "stray p end", selector: "p", body: "</p>" },
  { name: "br end", selector: "br", body: "</br>" },
] as const;

for (const mode of ["committed", "derived"] as const)
  for (const path of ["inline", "linked", "embedded"] as const)
    for (const item of cases)
      test(`${mode} ${path} ${item.name} respects the creating token's ignore status`, async (context) => {
        const before = `${item.selector}{color:red}`;
        const after = `${item.selector}{color:blue}`;
        const body = `${start}${item.body}${end}<span>Home</span>`;
        const shell = (styles: string) =>
          `import { renderToStaticMarkup } from 'react-dom/server'; export default input => input.entry.id === 'home' ? '<!doctype html><html><head>${styles}</head><body>${body}</body></html>' : '<!doctype html><html><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
        const embedded = path === "embedded";
        const linked = path !== "inline";
        const fixture = await inlineChangesFixture(
          context,
          embedded
            ? '<iframe src="../frame.html"></iframe>'
            : linked
              ? '<link rel="stylesheet" href="../sheet.css">'
              : `<style>${before}</style>`,
          embedded
            ? '<iframe src="../frame.html"></iframe>'
            : linked
              ? '<link rel="stylesheet" href="../sheet.css">'
              : `<style>${after}</style>`,
          {
            colorSchemes: false,
            source: componentEntrySource({
              body: !embedded && "jsx" in item ? item.jsx : "<span>Home</span>",
            }),
            ...(!embedded && !("jsx" in item)
              ? {
                  renderer: {
                    before: shell(
                      linked
                        ? '<link rel="stylesheet" href="../sheet.css">'
                        : `<style>${before}</style>`,
                    ),
                    after: shell(
                      linked
                        ? '<link rel="stylesheet" href="../sheet.css">'
                        : `<style>${after}</style>`,
                    ),
                  },
                }
              : {}),
            ...(linked
              ? {
                  files: {
                    before: {
                      "sheet.css": before,
                      ...(embedded
                        ? {
                            "frame.html": `<html><head><link rel="stylesheet" href="sheet.css"></head><body>${body}</body></html>`,
                          }
                        : {}),
                    },
                    after: {
                      "sheet.css": after,
                      ...(embedded
                        ? {
                            "frame.html": `<html><head><link rel="stylesheet" href="sheet.css"></head><body>${body}</body></html>`,
                          }
                        : {}),
                    },
                  },
                }
              : {}),
          },
        );
        const input = await pageFixtureInput(fixture, mode);
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
              "unchanged",
              "M6 suppresses created ignored subjects",
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
