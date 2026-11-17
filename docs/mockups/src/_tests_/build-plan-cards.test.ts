import assert from "node:assert/strict";
import { test } from "node:test";

import { members, sample } from "../fixtures/product";
import { billing } from "../fixtures/product-states";
import { pullRequest } from "../fixtures/publications";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import { buttons, contract, stageMarkup, views } from "./stage-card-pages";

/**
 * The Team card a pull request alias shows while the plan refuses
 * publishing, for an owner and for everyone else, beside the branch drawing
 * of the same card for the same reader.
 */
const planCards = [
  {
    path: "product/viewer/pull-request/plan",
    branch: "product/viewer/standalone/plan",
    reader: sample.viewer.name,
    buttons: [
      ["Open billing", "firna-button-primary", "product/settings/billing"],
      [
        "Choose another branch",
        "firna-button-secondary",
        "product/viewer/switcher",
      ],
    ],
  },
  {
    path: "product/viewer/pull-request/plan/reader",
    branch: "product/viewer/standalone/plan-reader",
    reader: members[2].name,
    line: billing.copy.askOwner,
    buttons: [
      [
        "Choose another branch",
        "firna-button-primary",
        "product/viewer/switcher",
      ],
    ],
  },
] as const;

test("a plan-refused pull request shows the branch's Team card by the reader's role", () => {
  for (const said of [
    "**Publishing to private projects is on Team**",
    "including an open pull request from the project's repository",
    "an owner gets Open billing",
    "“" + billing.copy.askOwner + "”",
  ])
    assert.ok(contract.includes(said), said);
  for (const card of planCards) {
    const branch = new Map(
      views(card.branch).map(({ view, page }) => [view, stageMarkup(page)]),
    );
    for (const { where, view, page } of views(card.path)) {
      // The chrome names the open pull request, its author and that nothing
      // is published, and on desktop the reader the card is drawn for.
      const bar = byClass(page, "fo-top-bar")[0];
      assert.ok(bar, where);
      const named = (text: string) =>
        elements(bar, (node) => label(node) === text).length > 0;
      const fullReference = pullRequest.number + " " + pullRequest.title;
      const references = elements(
        bar,
        (node) =>
          (node.tagName === "a" || node.tagName === "button") &&
          (attribute(node, "aria-label") ?? label(node)) === fullReference,
      );
      assert.equal(
        references.length,
        view.startsWith("desktop") ? 2 : 1,
        where + " names the pull request",
      );
      assert.deepEqual(
        references.map(label).sort(),
        (view.startsWith("desktop")
          ? [fullReference, pullRequest.number]
          : [pullRequest.number]
        ).sort(),
        where + " keeps the full and compact reference labels",
      );
      assert.equal(
        label(byClass(bar, "fo-top-state-detail")[0]),
        pullRequest.author + " · Not published",
        where,
      );
      if (view.startsWith("desktop"))
        assert.ok(named(card.reader), where + " names " + card.reader);
      // An owner is offered Billing beside the switcher; everyone else is
      // told who can upgrade and offered the switcher. Nothing says that a
      // check will publish it, and nothing is announced as a failure.
      const canvas = byClass(page, "fo-stage-canvas")[0];
      assert.deepEqual(byClass(canvas, "fo-state-title").map(label), [
        "Publishing to private projects is on Team",
      ]);
      assert.deepEqual(
        byClass(canvas, "fo-state-detail").map(label),
        "line" in card ? [card.line] : [],
        where,
      );
      assert.deepEqual(buttons(canvas), card.buttons, where);
      assert.equal(
        elements(canvas, (node) => attribute(node, "role") === "alert").length,
        0,
        where,
      );
      assert.equal(byClass(canvas, "fo-site-link").length, 0, where);
      assert.ok(!label(canvas).includes("Publishing starts"), where);
      // It is the same card the branch drawing shows for the same reader.
      assert.equal(stageMarkup(page), branch.get(view), where);
    }
  }
});
