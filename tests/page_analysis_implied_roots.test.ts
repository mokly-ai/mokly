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
    name: "implied body",
    selector: ".page",
    document: (styles: string) =>
      `<html><head>${styles}</head>text<body class="page">${start}<i>clock</i>${end}</html>`,
  },
  {
    name: "implied head",
    selector: "head",
    document: (styles: string) =>
      `<html>${start}<title>clock</title>${end}<body>${styles}<main>Home</main></body></html>`,
  },
];

for (const mode of ["committed", "derived"] as const)
  for (const path of ["inline", "linked", "embedded"] as const)
    for (const item of cases)
      test(`${mode} ${path} ${item.name} with only ignored children stays a matching subject`, async (context) => {
        const before = `${item.selector}{color:red}`;
        const after = `${item.selector}{color:blue}`;
        const embedded = path === "embedded";
        const linked = path !== "inline";
        const styles = (css: string) =>
          linked
            ? '<link rel="stylesheet" href="../sheet.css">'
            : `<style>${css}</style>`;
        const render = (css: string) =>
          `import { renderToStaticMarkup } from 'react-dom/server'; export default input => input.entry.path === 'home' ? ${JSON.stringify(item.document(styles(css)))} : '<!doctype html><html><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
        const host = `import { renderToStaticMarkup } from 'react-dom/server'; export default input => '<!doctype html><html>${start}<head></head>${end}<body><iframe src="' + '../'.repeat(input.entry.path.split('/').length) + 'frame.html"></iframe>' + renderToStaticMarkup(input.node) + '</body></html>';`;
        const fixture = await inlineChangesFixture(
          context,
          embedded ? '<iframe src="../frame.html"></iframe>' : "",
          embedded ? '<iframe src="../frame.html"></iframe>' : "",
          {
            colorSchemes: false,
            source: componentEntrySource({ body: "<span>Home</span>" }),
            renderer: {
              before: embedded ? host : render(before),
              after: embedded ? host : render(after),
            },
            ...(linked
              ? {
                  files: {
                    before: {
                      "sheet.css": before,
                      ...(embedded
                        ? {
                            "frame.html": item.document(
                              '<link rel="stylesheet" href="sheet.css">',
                            ),
                          }
                        : {}),
                    },
                    after: {
                      "sheet.css": after,
                      ...(embedded
                        ? {
                            "frame.html": item.document(
                              '<link rel="stylesheet" href="sheet.css">',
                            ),
                          }
                        : {}),
                    },
                  },
                }
              : {}),
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
          assert.equal(expected.view.state, "changed");
          if (path === "inline") assert.equal(expected.view.material, true);
          assert.deepEqual(result.comparison.view, expected.view, result.path);
          assert.deepEqual(
            result.comparison.reasons,
            expected.reasons,
            result.path,
          );
        }
      });
