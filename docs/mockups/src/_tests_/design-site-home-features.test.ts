/**
 * The features of the home: the four modules in their order with their
 * numbers, the Browse drawing of a click from one screen to the next, the
 * Changes compare, and the depictions, which hide from assistive technology.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { first, only } from "./design-site-home-helpers";
import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  textContent,
} from "./design-site-test-helpers";

/** Cal's Review body, word for word. */
const REVIEW_BODY =
  "Each comment is tied to the component it is about, so it stays put when the layout changes. Approve when it is right, in step with the pull request review.";

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the feature frames carry their kickers, headings and copy`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const intro = only(document, "site-section-head");
    const heading = elements(intro, (node) => node.tagName === "h2")[0];
    assert.ok(heading);
    assert.deepEqual(
      [
        ...heading.childNodes.map(textContent).filter(Boolean),
        first(intro, "p"),
      ],
      [
        "Browse, review, edit.",
        "One place for all of it.",
        "Every branch becomes a catalogue your whole team can open.",
      ],
    );
    const modules = byClass(document, "site-module");
    assert.deepEqual(
      modules.map((module) => [
        attribute(module, "id"),
        label(only(module, "site-kicker")),
        first(module, "h3"),
        label(only(module, "site-frame-name")),
      ]),
      [
        ["browse", "01 Browse", "Click through every screen.", "01 Browse"],
        [
          "changes",
          "02 Changes",
          "A visual diff for every branch.",
          "02 Changes",
        ],
        ["review", "03 Review", "Sticky comments.", "03 Review"],
        ["edit", "04 Edit", "Ask for the change beside the screen.", "04 Edit"],
      ],
    );
    assert.equal(label(only(modules[2]!, "site-module-body")), REVIEW_BODY);
  });

  test(`${viewport}: Browse draws Sam's press on Continue and the next screen open in the viewer`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const browse = only(document, "site-module--links");
    const source = only(browse, "site-home-links-source");
    assert.equal(
      label(only(source, "site-home-board-label")),
      "onboarding/welcome",
    );
    assert.equal(label(only(source, "site-acme-button")), "Continue");
    only(source, "site-home-links-press");
    only(source, "site-cursor--sam");
    const viewer = only(browse, "site-frame");
    assert.deepEqual(byClass(viewer, "site-row--current").map(label), [
      "pricing",
    ]);
    const section = only(viewer, "site-home-links-section");
    assert.deepEqual(
      [
        label(only(section, "site-section-box-tag")),
        label(only(section, "site-section-box-meta")),
        label(only(section, "site-home-board-label")),
      ],
      ["Pricing", "pricing", "Mobile · Light"],
    );
    assert.equal(byClass(viewer, "site-home-mode").length, 0, "no compare");
    assert.ok(
      byClass(browse, "site-home-fit-connector").length > 0,
      "the link line from Continue into the viewer",
    );
    const changes = only(only(document, "site-module--browse"), "site-frame");
    assert.deepEqual(byClass(changes, "site-row--current").map(label), [
      "payment",
    ]);
  });

  test(`${viewport}: the Changes compare lists the five modes with Swipe chosen`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const viewer = only(only(document, "site-module--browse"), "site-frame");
    // The product's order of the compare modes.
    assert.deepEqual(byClass(viewer, "site-home-mode").map(label), [
      "Current",
      "Side by side",
      "Overlay",
      "Difference",
      "Swipe",
    ]);
    assert.deepEqual(byClass(viewer, "site-home-mode--chosen").map(label), [
      "Swipe",
    ]);
    assert.equal(byClass(viewer, "site-home-swipe").length, 1);
    assert.deepEqual(byClass(viewer, "site-stage-label").map(label), [
      "main",
      "feat/checkout-v2",
    ]);
  });

  test(`${viewport}: the depictions are hidden from assistive technology and hold nothing to focus`, () => {
    const { document } = siteDocument("design/site/home", viewport);
    const review = only(document, "site-module--review");
    const depictions = [
      only(document, "site-home-spread"),
      only(document, "site-home-links-source"),
      only(document, "site-home-check"),
      ...byClass(document, "site-frame"),
      only(review, "site-detail"),
      only(document, "site-comment"),
      only(document, "site-home-edit-bar"),
      only(document, "site-home-edit-board"),
      only(document, "site-agent"),
      only(document, "site-home-source-board"),
      only(document, "site-home-connector"),
      ...byClass(document, "site-home-fit-connector"),
      ...byClass(document, "site-home-wire"),
    ];
    assert.equal(depictions.length, viewport === "desktop" ? 17 : 13);
    for (const depiction of depictions) {
      const name = attribute(depiction, "class") ?? depiction.tagName;
      assert.equal(attribute(depiction, "aria-hidden"), "true", name);
      assert.deepEqual(
        elements(depiction, (node) =>
          /^(?:a|button|input|select|textarea|h[1-6])$/.test(node.tagName),
        ).map((node) => node.tagName),
        [],
        `${name} holds no control and no heading`,
      );
    }
  });
}
