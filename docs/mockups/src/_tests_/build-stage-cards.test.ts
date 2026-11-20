import assert from "node:assert/strict";
import { test } from "node:test";

import { failureReference } from "../fixtures/product-states";
import { closedPullRequest, forkPullRequest } from "../fixtures/publications";

import {
  attribute,
  byClass,
  childElements,
  elements,
  label,
} from "./design-site-test-helpers";
import { buttons, views } from "./stage-card-pages";
import { publishCards, publishGuide } from "./stage-drawings";

/**
 * The cards a pull request alias with nothing published shows when no build
 * runs and nothing can publish it: how it closed, or that it is from a fork,
 * which builds never run for.
 */
const pullRequestCards = [
  {
    path: "product/viewer/pull-request/closed",
    pull: closedPullRequest,
    title: "This pull request is closed",
  },
  {
    path: "product/viewer/pull-request/closed/merged",
    pull: forkPullRequest,
    title: "This pull request was merged",
  },
  {
    path: "product/viewer/pull-request/fork",
    pull: forkPullRequest,
    title: "This pull request is from a fork",
    line: "Review this pull request’s screens locally.",
  },
] as const;

test("a closed, merged or fork pull request names why and offers only the switcher", () => {
  for (const card of pullRequestCards) {
    for (const { where, view, page } of views(card.path)) {
      // The chrome names the pull request, its author and that nothing is
      // published, as every pull request alias with nothing ready does.
      const bar = byClass(page, "fo-top-bar")[0];
      assert.ok(bar, where);
      const fullReference = card.pull.number + " " + card.pull.title;
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
      assert.equal(
        label(byClass(bar, "fo-top-state-detail")[0]),
        card.pull.author + " · Not published",
        where,
      );
      // The stage names why, with a line only where the reader can do
      // something else, no alert and no way to publish: its one action is the
      // switcher, with no one to ask and no CI guide.
      const canvas = byClass(page, "fo-stage-canvas")[0];
      assert.deepEqual(byClass(canvas, "fo-state-title").map(label), [
        card.title,
      ]);
      assert.deepEqual(
        byClass(canvas, "fo-state-detail").map(label),
        "line" in card ? [card.line] : [],
        where,
      );
      assert.equal(
        elements(canvas, (node) => attribute(node, "role") === "alert").length,
        0,
        where,
      );
      assert.deepEqual(
        buttons(canvas),
        [
          [
            "Choose another branch",
            "firna-button-primary",
            "product/viewer/switcher",
          ],
        ],
        where,
      );
      assert.equal(byClass(canvas, "fo-site-link").length, 0, where);
      for (const absent of ["Publishing starts", "Ask a member", "from CI"])
        assert.ok(!label(canvas).includes(absent), where + " " + absent);
    }
  }
});

test("a publishing card holds its control and the CI guide as one fragment", () => {
  for (const card of publishCards)
    for (const { where, page } of views(card.path)) {
      const canvas = byClass(page, "fo-stage-canvas")[0];
      assert.deepEqual(
        byClass(canvas, "fo-state-title").map(label),
        [card.title],
        where,
      );
      const [action] = byClass(canvas, "fo-state-action");
      const [held, ...beside] = childElements(action);
      assert.ok(held && beside.length === 0, where + " holds one action");
      // At rest the fragment stands alone. A refusal sets the whole fragment
      // between the cause and the reference, so the guide never falls below
      // Details.
      let row = held;
      if (card.cause === undefined)
        assert.equal(byClass(canvas, "fo-write-failure").length, 0, where);
      else {
        assert.equal(attribute(held, "class"), "fo-write-failure", where);
        const [said, control, details, ...rest] = childElements(held);
        assert.equal(rest.length, 0, where);
        assert.deepEqual(
          [attribute(said, "class"), attribute(said, "role"), label(said)],
          ["fo-copy", "alert", card.cause],
          where,
        );
        assert.equal(attribute(details, "class"), "fo-error-details", where);
        assert.ok(label(details).includes(failureReference), where);
        row = control;
      }
      assert.equal(attribute(row, "class"), "fo-control-guide", where);
      const [control, guide, ...more] = childElements(row);
      assert.equal(more.length, 0, where);
      // A refusal the same request could get past reads the way back and
      // still leads to the build; one it cannot keeps the label and leads
      // nowhere new.
      assert.deepEqual(
        buttons(row),
        [[card.control, "firna-button-primary", card.opens]],
        where,
      );
      assert.deepEqual(buttons(control), buttons(row), where);
      assert.deepEqual(
        [
          attribute(guide, "class"),
          label(guide),
          attribute(guide, "href"),
          attribute(guide, "target"),
          attribute(guide, "rel"),
        ],
        [
          "fo-site-link",
          publishGuide.label,
          publishGuide.href,
          "_blank",
          "noopener noreferrer",
        ],
        where,
      );
    }
});
