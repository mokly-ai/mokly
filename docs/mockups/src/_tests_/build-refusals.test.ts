import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { parse } from "parse5";

import { causes, failureReference } from "../fixtures/product-states";
import { drawings } from "./build-drawings";
import type { Drawing } from "./build-drawings";
import { catalogueRoot, screenFile } from "./catalogue-paths";
import {
  attribute,
  byClass,
  childElements,
  label,
} from "./design-site-test-helpers";
import type { Element } from "./design-site-test-helpers";
import { publishCards } from "./stage-drawings";

/** One protocol document as one line of words, for quoted copy. */
function words(document: string): string {
  return readFileSync(
    resolve(catalogueRoot, "../protocol", document),
    "utf8",
  ).replace(/\s+/g, " ");
}

const contract = words("viewer-builds.md");

/** The refused drawings of the build card whose control reads this label. */
function refusedBy(control: string): Drawing[] {
  return drawings.filter(
    (drawing) =>
      drawing.refusal !== undefined && drawing.action?.label === control,
  );
}

/**
 * Every view of one refused drawing's action column, which holds the whole
 * write-failure fragment and nothing beside it: the refusal as its own alert,
 * the control that sent the request, and the reference beneath both. A
 * refusal adds no guide, so the control with its guide is the control alone.
 */
function fragments(path: string): { where: string; control: Element }[] {
  return (["mobile", "desktop"] as const).flatMap((viewport) =>
    (["light", "dark"] as const).map((scheme) => {
      const where = path + " " + viewport + " " + scheme;
      const page = parse(
        readFileSync(screenFile(path, viewport, scheme), "utf8"),
      );
      const [place] = byClass(page, "fo-build-action");
      assert.ok(place, where);
      const [fragment, ...beside] = childElements(place);
      assert.ok(fragment && beside.length === 0, where + " one fragment");
      assert.equal(attribute(fragment, "class"), "fo-write-failure", where);
      const [said, control, details, ...rest] = childElements(fragment);
      assert.equal(rest.length, 0, where);
      const drawing = drawings.find((each) => each.path === path);
      assert.deepEqual(
        [attribute(said, "class"), attribute(said, "role"), label(said)],
        ["fo-copy", "alert", drawing?.refusal?.cause],
        where,
      );
      assert.equal(byClass(fragment, "fo-site-link").length, 0, where);
      assert.equal(attribute(details, "class"), "fo-error-details", where);
      assert.ok(label(details).includes(failureReference), where);
      return { where, control };
    }),
  );
}

test("every refused build request comes from the card's own control", () => {
  for (const drawing of drawings.filter(({ refusal }) => refusal))
    assert.ok(
      ["Try again", "Cancel"].includes(drawing.action?.label ?? ""),
      drawing.path,
    );
});

test("a refused Try again stands above the control, with no guide", () => {
  const refused = refusedBy("Try again");
  assert.deepEqual(
    refused.map(({ path, refusal }) => [path, refusal]),
    [
      [
        "product/viewer/standalone/build/refused",
        { cause: causes.closedPullRequest },
      ],
    ],
  );
  for (const { path, refusal } of refused) {
    if (refusal === undefined) continue;
    assert.ok(contract.includes("“" + refusal.cause + "”"), refusal.cause);
    // The same request would be refused again, so the control keeps its own
    // label and is not a link to anywhere new.
    for (const { where, control } of fragments(path))
      assert.deepEqual(
        [label(control), attribute(control, "data-testid"), control.tagName],
        ["Try again", "firna-button-primary", "button"],
        where,
      );
  }
});

test("a refused Cancel keeps its label, as the Cancel rule says", () => {
  const refused = refusedBy("Cancel");
  assert.deepEqual(
    refused.map(({ path, refusal }) => [path, refusal]),
    [
      [
        "product/viewer/standalone/build/refused/cancel",
        {
          cause: causes.busy,
          opens: "product/viewer/standalone/build/superseded/cancelled",
        },
      ],
    ],
  );
  // The contract keeps Cancel after a refusal, as the write-failure
  // fragment's one named exception, because Try again on a build card
  // requests a new build.
  for (const said of [
    "A refused or failed Cancel shows its cause above the control through the write-failure fragment.",
    "The control keeps Cancel, with Cancelling… while it runs, because Try again on a build card requests a new build.",
  ])
    assert.ok(contract.includes(said), said);
  const chrome = words("folio-chrome.md");
  assert.ok(chrome.includes("**Named exception: Build Cancel.**"));
  assert.ok(
    chrome.includes(
      "keeps the operation label after a refusal or failure, including one that another request could overcome",
    ),
  );
  // Mokly being busy is such a refusal: the publishing card's control reads
  // the way back for it, while Cancel keeps its own label.
  assert.equal(
    publishCards.find((card) => card.cause === causes.busy)?.control,
    "Try again",
  );
  for (const { path, refusal } of refused)
    for (const { where, control } of fragments(path))
      // Pressing it again can still cancel the build, so it leads there.
      assert.deepEqual(
        [
          label(control),
          attribute(control, "data-testid"),
          control.tagName,
          attribute(control, "data-mokly-link"),
        ],
        ["Cancel", "firna-button-secondary", "a", refusal?.opens],
        where,
      );
});
