import assert from "node:assert/strict";
import test from "node:test";

import { parse as parseSelector } from "css-what";

import { selectDocument } from "../dist/review/css/document_query.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { inlineChangesFixture } from "./helpers/inline_changes.js";
import { comparePageViews } from "./helpers/page_comparison.js";
import { pageFixtureInput } from "./helpers/page_fixture_inputs.js";

const start = "<!--mokly-review-ignore:start:adoption-->";
const end = "<!--mokly-review-ignore:end:adoption-->";
const cases = [
  {
    name: "ignored page class",
    ignoredClass: "page",
    selector: ".page",
    old: false,
    current: true,
  },
  {
    name: "ignored hidden shadows visible",
    ignoredClass: "hidden",
    selector: ".visible",
    old: true,
    current: false,
  },
];

for (const mode of ["committed", "derived"] as const)
  for (const path of ["inline", "linked", "embedded"] as const)
    for (const ignoredFirst of [true, false])
      for (const tag of ["html", "body"])
        for (const item of cases)
          test(`${mode} ${path} ${tag} ${item.name}, ignored first=${ignoredFirst}, preserves browser adoption`, async (context) => {
            const ignored = `${start}<${tag} class="${item.ignoredClass}">${end}`;
            const visible = `<${tag} class="visible">`;
            const tags = ignoredFirst ? ignored + visible : visible + ignored;
            const before = `${item.selector}{color:red}`;
            const after = `${item.selector}{color:blue}`;
            const document = (styles: string) =>
              `<!doctype html><html><head>${styles}</head><body><span>Home</span>${tags}</body></html>`;
            const linked = path !== "inline";
            const styles = (css: string) =>
              linked
                ? '<link rel="stylesheet" href="../../sheet.css">'
                : `<style>${css}</style>`;
            const renderer = (css: string) =>
              `import { renderToStaticMarkup } from 'react-dom/server'; export default input => input.entry.path === 'home' ? ${JSON.stringify(document(styles(css)))} : '<!doctype html><html><body>' + renderToStaticMarkup(input.node) + '</body></html>';`;
            const embedded = path === "embedded";
            const fixture = await inlineChangesFixture(
              context,
              embedded ? '<iframe src="../frame.html"></iframe>' : "",
              embedded ? '<iframe src="../frame.html"></iframe>' : "",
              {
                colorSchemes: false,
                source: componentEntrySource({ body: "<span>Home</span>" }),
                ...(!embedded
                  ? {
                      renderer: {
                        before: renderer(before),
                        after: renderer(after),
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
                                "frame.html": document(
                                  '<link rel="stylesheet" href="sheet.css">',
                                ),
                              }
                            : {}),
                        },
                        after: {
                          "sheet.css": after,
                          ...(embedded
                            ? {
                                "frame.html": document(
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
            const oldChanged = ignoredFirst
              ? item.old
              : item.selector === ".visible";
            const currentChanged = ignoredFirst
              ? item.current
              : item.selector === ".visible";
            for (const [results, changed] of [
              [old, oldChanged],
              [current, currentChanged],
            ] as const)
              for (const result of results.filter(
                ({ entryId }) => entryId === "home",
              )) {
                const {
                  view,
                  reasons,
                  changedImplementations,
                  ownedResources,
                  inlineEvidence,
                } = result.comparison;
                assert.equal(view.state, changed ? "changed" : "unchanged");
                assert.deepEqual([...changedImplementations], []);
                assert.deepEqual(ownedResources, []);
                if (path === "inline") {
                  assert.deepEqual(
                    reasons,
                    changed ? [{ kind: "material" }] : [],
                  );
                  assert.deepEqual(view, {
                    viewport: view.viewport,
                    colorScheme: view.colorScheme,
                    ignoredIds: [],
                    state: changed ? "changed" : "unchanged",
                    ...(changed ? { material: true } : {}),
                    inlineStyles: changed
                      ? { status: "matched", selectors: [item.selector] }
                      : { status: "excluded" },
                  });
                  assert.equal(inlineEvidence?.allExcluded, !changed);
                } else {
                  const reason = {
                    kind: "dependency",
                    path: "mockups/sheet.css",
                    analysis: { status: "matched", selectors: [item.selector] },
                  };
                  assert.deepEqual(reasons, changed ? [reason] : []);
                  assert.deepEqual(view, {
                    viewport: view.viewport,
                    colorScheme: view.colorScheme,
                    ignoredIds: [],
                    state: changed ? "changed" : "unchanged",
                    ...(changed
                      ? { reasons: [reason] }
                      : {
                          excludedResources: [
                            {
                              path: "mockups/sheet.css",
                              reason: "no-matching-rule",
                            },
                          ],
                        }),
                  });
                }
              }
          });

for (const tag of ["html", "body"])
  test(`${tag} adopted ignored attributes remain matcher context while their references are dropped`, () => {
    const source = `<html><head></head><body><span>Home</span>${start}<${tag} class="page" style="background:url(ignored.svg)">${end}</body></html>`;
    const analysis = new PageAnalysis(source, "adoption.html");
    assert.equal(
      selectDocument(parseSelector(".page"), analysis.matching(["adoption"]))
        .length,
      1,
    );
    assert.deepEqual(
      analysis.references
        .filter(({ value }) => value === "ignored.svg")
        .map(({ value }) => value),
      ["ignored.svg"],
    );
    assert.deepEqual(analysis.conservativeReferences(["adoption"]), []);
  });
