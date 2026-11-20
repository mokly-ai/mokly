import assert from "node:assert/strict";
import { test } from "node:test";

import type { DefaultTreeAdapterMap } from "parse5";

import { groups, plans, team, threads } from "./design-site-pricing-copy";
import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
  siteDocument,
  siteStyles,
  type Element,
} from "./design-site-test-helpers";

type Node = DefaultTreeAdapterMap["node"];

/** The text a screen reader reads: aria-hidden subtrees left out. */
function spoken(node: Node): string {
  const read = (current: Node): string => {
    if ("value" in current) return current.value;
    if ("tagName" in current && attribute(current, "aria-hidden") === "true")
      return "";
    return "childNodes" in current ? current.childNodes.map(read).join("") : "";
  };
  return read(node).replace(/\s+/g, " ").trim();
}

/** The elements of one tag name under a node, in document order. */
function tags(node: Node, name: string): Element[] {
  return elements(node, (element) => element.tagName === name);
}

/** The pricing document's `main` in one viewport. */
function pricingMain(viewport: "mobile" | "desktop"): Element {
  const { document } = siteDocument("design/site/pricing", viewport);
  const main = tags(document, "main")[0];
  assert.ok(main, "pricing main");
  return main;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: pricing draws the three plans with their prices and actions`, () => {
    const main = pricingMain(viewport);
    assert.equal(
      spoken(tags(main, "h1")[0]!),
      "Free for open source. Team for private projects.",
    );
    assert.deepEqual(
      byClass(main, "site-section-box").map((box) => [
        label(byClass(box, "site-section-box-tag")[0]!),
        ...tags(box, "h3").map(label),
      ]),
      [
        ["Mokly CLI", "Open source"],
        ["Mokly Cloud", "Free", "Team"],
      ],
    );
    const frames = byClass(main, "site-pricing-plan");
    assert.deepEqual(
      frames.map((frame) => {
        const links = tags(frame, "a");
        assert.equal(links.length, 1, "one action for each plan");
        const link = links[0]!;
        return {
          action: [
            label(link),
            (attribute(link, "class") ?? "")
              .split(" ")
              .find((name) => name.startsWith("site-button--")),
            attribute(link, "data-mokly-link"),
          ],
          amounts: byClass(frame, "site-pricing-amount").map(label),
          name: label(tags(frame, "h3")[0]!),
          notes: [
            ...byClass(frame, "site-pricing-price-note"),
            ...byClass(frame, "site-pricing-seat-unit"),
          ].map(spoken),
        };
      }),
      plans,
    );
    assert.deepEqual(
      frames.map((frame) => byClass(frame, "site-pricing-fine").map(label)),
      [[], [], ["In US dollars, before tax."]],
      "the currency line sits under Team's action only",
    );
    assert.equal(
      tags(main, "a").length,
      3,
      "the plan actions are the only links on the page",
    );
  });

  test(`${viewport}: Team is the selected plan frame and the canvas marks stay out of the reading`, () => {
    const main = pricingMain(viewport);
    const frames = byClass(main, "site-pricing-plan");
    assert.deepEqual(
      frames.map((frame) => [
        label(byClass(frame, "site-frame-name")[0]!),
        byClass(frame, "site-frame-name--selected").length,
        byClass(frame, "site-sel").length,
        byClass(frame, "site-cursor--maya").length,
      ]),
      [
        ["plans/open-source", 0, 0, 0],
        ["plans/free", 0, 0, 0],
        ["plans/team", 1, 1, 1],
      ],
    );
    const selection = byClass(frames[2]!, "site-sel")[0]!;
    assert.equal(byClass(selection, "site-sel-handle").length, 4);
    assert.match(label(byClass(selection, "site-size-tag")[0]!), /^\d+ × \d+$/);
    for (const name of [
      "site-frame-name",
      "site-sel",
      "site-cursor",
      "site-redline",
      "site-avatar",
      "site-pricing-thread-pin",
    ]) {
      const marks = byClass(main, name);
      assert.ok(marks.length > 0, name);
      for (const mark of marks)
        assert.equal(attribute(mark, "aria-hidden"), "true", name);
    }
  });

  test(`${viewport}: the comparison is one captioned table of grouped plan properties`, () => {
    const tables = tags(pricingMain(viewport), "table");
    assert.equal(tables.length, 1);
    const table = tables[0]!;
    assert.equal(label(tags(table, "caption")[0]!), "What each plan includes");
    assert.deepEqual(
      elements(table, (node) => attribute(node, "scope") === "col").map(spoken),
      ["Property", "Open source", "Free", "Team"],
    );
    assert.deepEqual(
      tags(table, "tbody").map((body) =>
        tags(body, "th").map((cell) => [
          attribute(cell, "scope"),
          spoken(cell),
        ]),
      ),
      groups.map(([group, ...rows]) => [
        ["rowgroup", group],
        ...rows.map((row) => ["row", row]),
      ]),
    );
    const rows = tags(table, "tr").filter((row) => tags(row, "td").length > 0);
    assert.deepEqual(
      rows.map((row) => spoken(childElements(row)[3]!)),
      team,
    );
    for (const cell of rows.flatMap((row) => tags(row, "td"))) {
      if (byClass(cell, "site-pricing-check").length > 0)
        assert.equal(spoken(cell), "Included", "a check reads Included");
      if (byClass(cell, "site-pricing-dash").length > 0)
        assert.equal(spoken(cell), "Not included", "a dash reads Not included");
    }
    const head = tags(tags(table, "thead")[0]!, "tr")[0]!;
    for (const row of [head, ...rows])
      assert.deepEqual(
        childElements(row).map((cell) =>
          (attribute(cell, "class") ?? "").includes("site-pricing-props-team"),
        ),
        [false, false, false, true],
        "the Team column is tinted, and only it",
      );
  });

  test(`${viewport}: the questions are eight resolved threads beside a documentation action without a link`, () => {
    const section = byClass(
      pricingMain(viewport),
      "site-pricing-questions",
    )[0]!;
    assert.equal(spoken(tags(section, "h2")[0]!), "Questions, resolved.");
    assert.deepEqual(
      byClass(section, "site-pricing-thread").map((thread) => [
        spoken(byClass(thread, "site-pricing-thread-head")[0]!),
        ...byClass(thread, "site-pricing-message-meta").map(spoken),
        label(tags(thread, "h3")[0]!),
        byClass(thread, "site-pricing-answer").length,
      ]),
      threads.map(([topic, asker, question]) => [
        `${topic} Resolved`,
        asker,
        "Mokly",
        question,
        1,
      ]),
    );
    assert.equal(
      spoken(byClass(section, "site-pricing-docs")[0]!),
      "Read Plans and billing",
    );
    assert.equal(
      tags(section, "a").length,
      0,
      "no mockup owns Plans and billing",
    );
  });
}

test("split site styles own the pricing compositions", () => {
  const css = siteStyles();
  for (const selector of [
    ".site-pricing-plan",
    ".site-pricing-props",
    ".site-pricing-thread",
  ])
    assert.ok(css.includes(`${selector} {`), selector);
  assert.match(css, /\[data-site-viewport="mobile"\] \.site-pricing-props tr/);
});
