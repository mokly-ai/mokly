import assert from "node:assert/strict";
import test from "node:test";

import { viewHref } from "../src/navigation/routes.js";

import { registerDom } from "./canvas_frame_fixture.js";
import {
  detailPairs,
  rawDetailFixtures,
  rawIndexFixture,
} from "./catalogue_v9_fixture.js";
import {
  heldEmbeddedMarkup,
  type HeldEmbeddedMarkupOptions,
} from "./presentation_v7_helpers.js";

/** The parts of the routed entry's Changes tab, once its details arrived. */
function changesTab(options: HeldEmbeddedMarkupOptions) {
  document.body.innerHTML = heldEmbeddedMarkup(options);
  const tab = document.querySelector(
    '[role="tabpanel"][id$="mb-panel-body-changes"]',
  );
  assert.ok(tab, "the entry has a Changes tab");
  const text = (selector: string) =>
    [...tab.querySelectorAll(selector)].map((node) => node.textContent);
  return {
    stepper: text(".mbk-change-stepper-count"),
    rail: text(".mbk-compared-version, .mbk-compared-note"),
    modes: text("[data-diff-mode]"),
    details: text(".mbk-changes-details p"),
    links: [...tab.querySelectorAll(".mbk-changes-details a")].map((link) =>
      link.getAttribute("href"),
    ),
  };
}

test("a document that the branch added has the stepper, its current version alone, no modes, and its reason's sentence", (t) => {
  registerDom(t);
  assert.deepEqual(changesTab({ selection: { screenPath: "product" } }), {
    stepper: ["Change 1 of 5"],
    rail: [
      "Current This branch",
      "Added on this branch, so there is no base to compare.",
    ],
    modes: [],
    details: ["Added to this branch."],
    links: [],
  });
});

test("a removed page has the stepper, its version before alone, no modes, and its removed record's reason", (t) => {
  registerDom(t);
  const removed = rawIndexFixture().removedEntries.find(
    ({ entry }) => entry.path === "product/removed-page",
  );
  assert.ok(removed);
  assert.deepEqual(
    changesTab({
      selection: {
        screenPath: "product/removed-page",
        snapshotId: removed.snapshotId,
      },
    }),
    {
      stepper: ["Change 5 of 5"],
      rail: [
        "Before Branch point on main",
        "Removed on this branch, so there is no current version to compare.",
      ],
      modes: [],
      details: ["Removed on this branch."],
      links: [],
    },
  );
});

test("a use case that Changes lists names each changed step by its own title, or else its screen's, linked to the step's screen", (t) => {
  registerDom(t);
  const index = rawIndexFixture();
  const tour = index.useCases.find(({ path }) => path === "tour");
  assert.ok(tour);
  tour.changes = { status: "ready", kind: "changed", included: true };
  const details = rawDetailFixtures();
  const held = details.current["tour"];
  assert.ok(held);
  held.reasons = [
    { kind: "screen", screenPath: "product/browse/home" },
    { kind: "screen", screenPath: "product/browse/details" },
  ];
  assert.deepEqual(
    changesTab({
      details: detailPairs(undefined, details),
      index,
      selection: { screenPath: "tour" },
    }),
    {
      stepper: ["Change 5 of 6"],
      rail: ["Before Branch point on main", "Current This branch"],
      modes: [],
      details: ["Changed step: Start", "Changed step: Details"],
      links: [
        viewHref("product/browse/home"),
        viewHref("product/browse/details"),
      ],
    },
  );
});
