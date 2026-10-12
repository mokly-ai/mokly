import assert from "node:assert/strict";
import test from "node:test";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const cases = [
  {
    selector: ".ignored + .subject",
    body: '<div><ReviewIgnore id="context"><i className="ignored" /></ReviewIgnore><b className="subject" /></div>',
    old: "excluded",
    current: "matched",
  },
  {
    selector: ".subject:nth-child(2)",
    body: '<div><ReviewIgnore id="context"><i /></ReviewIgnore><b className="subject" /></div>',
    old: "excluded",
    current: "matched",
  },
  {
    selector: ".subject:has(.ignored)",
    body: '<div className="subject"><ReviewIgnore id="context"><i className="ignored" /></ReviewIgnore></div>',
    old: "excluded",
    current: "matched",
  },
  {
    selector: ".subject:empty",
    body: '<div className="subject"><ReviewIgnore id="context"><i /></ReviewIgnore></div>',
    old: "matched",
    current: "excluded",
  },
  {
    selector: ".ignored",
    body: '<ReviewIgnore id="context"><i className="ignored" /></ReviewIgnore>',
    old: "excluded",
    current: "excluded",
  },
  {
    selector: ".subject:has(.ignored)",
    body: '<div className="subject"><template><i className="ignored" /></template></div>',
    old: "excluded",
    current: "excluded",
  },
] as const;

for (const linked of [false, true])
  for (const [index, item] of cases.entries())
    test(`${linked ? "linked" : "inline"} original-context case ${index}: ${item.selector}`, async (context) => {
      const before = `${item.selector}{color:red}`;
      const after = `${item.selector}{color:blue}`;
      const fixture = await inlineChangesFixture(
        context,
        linked
          ? '<link rel="stylesheet" href="../sheet.css">'
          : `<style>${before}</style>`,
        linked
          ? '<link rel="stylesheet" href="../sheet.css">'
          : `<style>${after}</style>`,
        {
          source: componentEntrySource({ body: item.body }),
          colorSchemes: false,
          ...(linked
            ? {
                files: {
                  before: { "sheet.css": before },
                  after: { "sheet.css": after },
                },
              }
            : {}),
        },
      );
      const input = await pageFixtureInput(fixture, "committed");
      const collect = async (oracle: boolean) => {
        const results = (await comparePageViews(input, oracle)).filter(
          ({ entryId }) => entryId === "home",
        );
        assert.equal(results.length, 2);
        for (const { comparison, path } of results) {
          const evidence = linked
            ? (comparison.view.reasons?.flatMap((reason) =>
                reason.analysis ? [reason.analysis] : [],
              ) ?? [])
            : comparison.view.inlineStyles
              ? [comparison.view.inlineStyles]
              : [];
          const status = evidence.some(({ status }) => status === "matched")
            ? "matched"
            : "excluded";
          assert.equal(status, oracle ? item.old : item.current, path);
          if (status === "excluded")
            assert.ok(
              linked
                ? comparison.view.excludedResources?.some(
                    ({ path }) => path === "mockups/sheet.css",
                  )
                : comparison.view.inlineStyles?.status === "excluded",
              path,
            );
        }
      };
      await collect(true);
      await collect(false);
    });
