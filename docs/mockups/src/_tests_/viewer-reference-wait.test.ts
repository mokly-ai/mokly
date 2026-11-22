/**
 * The viewer's bar while a publication's address is read, as every alias
 * opens it once it resolves. The address names no reference, so the
 * reference trigger is a control whose label the answer decides, which the
 * Wait composition in `folio-chrome.md` draws as a placeholder over its own
 * frame. The project is known, so the rest of the bar is the loaded bar. The
 * stage's waiting card, titled with the read, is checked with the other stage
 * reads in `viewer-waits.test.ts`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { sample } from "../fixtures/product";
import { publication } from "../fixtures/publications";

import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import { buttonsIn, controlStates, drawnPage, only } from "./drawn-page";

/** The drawing of a publication's address while its publication is read. */
const publicationRead = "product/viewer/standalone/publication-loading";

/**
 * The bar's controls once the project is known, and whether each is
 * disabled: the project switcher, History, Share and the account's avatar,
 * whose control keeps the reader's name, in the full bar, and More in the
 * compact bar. Settings lives in the account menu, not in the bar. A phone
 * draws the compact bar only, and a desktop drawing draws both for the switch
 * in `viewer-bar.css` to show one. None of them waits for the publication.
 */
const loadedBar = {
  desktop: [
    [sample.workspace + " / " + sample.project, false],
    ["History", false],
    ["Share", false],
    [sample.viewer.name, false],
    ["More", false],
  ],
  mobile: [["More", false]],
} as const;

test("a publication's address waits for its reference in the trigger's own frame", () => {
  for (const viewport of ["desktop", "mobile"] as const) {
    const where = publicationRead + " " + viewport;
    const page = drawnPage(publicationRead, viewport);
    const bar = only(page.main, "fo-top-bar");
    // The bar is not part of the stage's wait: each control whose label is
    // known keeps its loaded form.
    assert.equal(byClass(bar, "fo-wait").length, 0, where);
    assert.deepEqual(controlStates(bar), loadedBar[viewport], where);
    // The project's control keeps the whole name, which the project read gave.
    if (viewport === "desktop")
      assert.deepEqual(
        buttonsIn(only(bar, "fo-top-project")).map((button) =>
          attribute(button, "aria-label"),
        ),
        [sample.workspace + " / " + sample.project],
        where,
      );
    // Nothing names the reference, so its trigger is a placeholder in the
    // reference's own frame, hidden from assistive technology.
    const slot = only(bar, "fo-top-grow");
    const frame = only(slot, "fo-top-reference");
    const placeholder = only(frame, "fo-wait-control");
    assert.equal(attribute(placeholder, "aria-hidden"), "true", where);
    assert.equal(label(frame), "", where);
    // The state beside it keeps its known word, which names no read.
    const state = only(slot, "fo-top-state");
    assert.equal(label(state), "Loading", where);
    assert.equal(byClass(state, "fo-pending-label").length, 0, where);
    // The page's one heading names the project alone, and nothing on the
    // page names the branch that the publication will name.
    assert.deepEqual(
      elements(page.main, (node) => node.tagName === "h1").map(label),
      [sample.project],
      where,
    );
    assert.equal(page.html.includes(publication.branch), false, where);
  }
});
