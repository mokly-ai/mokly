/**
 * The writes of the viewer's stage cards: Publish on the publishing card, and
 * Try again and Cancel on a build card. While a request runs, the pressed
 * control carries the wait, as Write in progress in `folio-chrome.md`
 * defines: it keeps its place with its working word and the busy spinner, it
 * stays focusable while it refuses a second press, a screen reader hears the
 * operation, and the card inserts nothing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Viewport } from "./catalogue-paths";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import {
  actions,
  busyActions,
  busyControl,
  drawnPage,
  pendingLabels,
} from "./drawn-page";
import type { DrawnPage } from "./drawn-page";

const viewports: readonly Viewport[] = ["desktop", "mobile"];

/**
 * Each request: the card at rest and while the request runs, the control
 * that sends it with the working word it then shows, and what screen readers
 * hear.
 */
const writes = [
  {
    resting: "product/viewer/standalone/publish",
    running: "product/viewer/standalone/publish-busy",
    control: "Publish this branch",
    working: "Publishing…",
    heard: "Publishing this branch…",
  },
  {
    resting: "product/viewer/standalone/build/failed",
    running: "product/viewer/standalone/build/try-again-busy",
    control: "Try again",
    working: "Publishing…",
    heard: "Publishing this branch…",
  },
  {
    resting: "product/viewer/standalone/build",
    running: "product/viewer/standalone/build/cancel-busy",
    control: "Cancel",
    working: "Cancelling…",
    heard: "Cancelling this build…",
  },
] as const;

/** Every link on the page, as its text and where it leads. */
function pageLinks(page: DrawnPage): [string, string][] {
  return elements(page.main, (element) => element.tagName === "a").map(
    (link) => [
      label(link),
      attribute(link, "data-mokly-link") ?? attribute(link, "href") ?? "",
    ],
  );
}

/** The texts the card says around its control, which a request leaves alone. */
const cardTexts = [
  "fo-state-title",
  "fo-build-reference",
  "fo-build-line",
  "fo-build-step-state",
  "fo-build-lines",
] as const;

test("a stage card's request holds only the pressed control busy and inserts nothing", () => {
  for (const viewport of viewports)
    for (const write of writes) {
      const where = write.running + " " + viewport;
      const resting = drawnPage(write.resting, viewport);
      const running = drawnPage(write.running, viewport);
      // The same controls in the same order: only the pressed one changed,
      // and it shows its working word.
      assert.deepEqual(
        actions(running),
        actions(resting).map(([tone, name]) => [
          tone,
          name === write.control ? write.working : name,
        ]),
        where,
      );
      assert.deepEqual(busyActions(running), [write.working], where);
      assert.deepEqual(busyActions(resting), [], where);
      // A busy control refuses the press through `busy` and keeps focus.
      const control = busyControl(running, where);
      assert.notEqual(attribute(control, "aria-disabled"), "true", where);
      assert.equal(attribute(control, "tabindex"), "0", where);
      // The control already says it on screen, so the operation is heard only.
      assert.deepEqual(
        pendingLabels(running),
        [[write.heard, "screen-reader-only"]],
        where,
      );
      // Nothing is inserted beside the control, and the card says what it
      // said at rest.
      for (const inserted of ["fo-pending", "fo-wait", "fo-write-failure"])
        assert.deepEqual(byClass(running.main, inserted), [], where);
      for (const text of cardTexts)
        assert.deepEqual(
          byClass(running.main, text).map(label),
          byClass(resting.main, text).map(label),
          where + " " + text,
        );
      // Every way on stays, the CI setup guide included, but the pressed
      // control, which leads nowhere while it works.
      assert.deepEqual(
        pageLinks(running),
        pageLinks(resting).filter(([name]) => name !== write.control),
        where,
      );
    }
});
