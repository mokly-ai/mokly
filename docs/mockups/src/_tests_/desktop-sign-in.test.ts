/**
 * The desktop app's sign-in through the browser: the entry screen of the
 * app's window, the connect page that issues the grant in the browser, and
 * the landing in the window that exchanges it. `desktop-sign-in.md` sets the
 * entry and the connect page, and `auth-callbacks.md` the landing.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { onboarding } from "../fixtures/product-states";

import type { Scheme, Viewport } from "./catalogue-paths";
import { byClass, elements, label } from "./design-site-test-helpers";
import {
  actions,
  busyActions,
  controlStates,
  destination,
  drawnPage,
  links,
  only,
  pendingLabels,
  waitRegion,
} from "./drawn-page";
import type { DrawnPage } from "./drawn-page";

/** Every view one page is drawn in. */
const views = [
  ["mobile", "light"],
  ["mobile", "dark"],
  ["desktop", "light"],
  ["desktop", "dark"],
] as const satisfies readonly (readonly [Viewport, Scheme])[];

/** One page in every view, each with the name a failure reports. */
function drawings(id: string): [string, DrawnPage][] {
  return views.map(([viewport, scheme]) => [
    id + " " + viewport + " " + scheme,
    drawnPage(id, viewport, scheme),
  ]);
}

/** The panel's one heading and the line beneath it, when it has one. */
function heading(page: DrawnPage): [string, string | undefined] {
  const [title] = byClass(page.main, "fo-account-heading").flatMap((block) =>
    block.childNodes.filter(
      (node) => "tagName" in node && node.tagName === "h1",
    ),
  );
  const [line] = byClass(page.main, "fo-account-detail");
  return [title ? label(title) : "", line ? label(line) : undefined];
}

test("the window's entry opens the connect page and offers no other way in", () => {
  for (const [id, title, action] of [
    [
      "product/account/sign-in/desktop",
      "Sign in to Mokly",
      "Continue in browser",
    ],
    [
      "product/account/sign-up/desktop",
      "Create your account",
      "Continue in browser",
    ],
    [
      "product/account/sign-in/desktop/waiting",
      "Check your browser",
      "Open browser again",
    ],
    [
      "product/account/sign-up/desktop/waiting",
      "Check your browser",
      "Open browser again",
    ],
  ] as const)
    for (const [where, page] of drawings(id)) {
      assert.deepEqual(heading(page), [title, undefined], where);
      assert.deepEqual(actions(page), [["primary", action]], where);
      assert.deepEqual(
        links(page, action).map(destination),
        ["product/account/connect-desktop"],
        where,
      );
      // No email field, and no switch to the other entry screen: the browser
      // page offers every way in.
      assert.ok(!page.html.includes("<input"), where + " draws no field");
      assert.equal(byClass(page.main, "fo-account-switch").length, 0, where);
    }
});

test("the connect page names the browser's account and offers Open Mokly only where its state allows", () => {
  const confirmation = "Signed in as " + onboarding.email;
  const secondary = ["secondary", "Use another account"];
  for (const [state, title, line, drawn] of [
    [
      "",
      "Sign in to the Mokly app",
      confirmation,
      [["primary", "Open Mokly"], secondary],
    ],
    ["/empty", "This link isn’t valid", undefined, []],
    [
      "/loading",
      "Sign in to the Mokly app",
      confirmation,
      [["primary", "Opening…"], secondary],
    ],
    [
      "/error",
      "Sign in to the Mokly app",
      confirmation,
      [["primary", "Try again"], secondary],
    ],
    [
      "/opened",
      "Continue in the Mokly app",
      undefined,
      [["primary", "Open Mokly"]],
    ],
    [
      "/session-loading",
      "Sign in to the Mokly app",
      "Loading your account…",
      [["primary", "Open Mokly"], secondary],
    ],
  ] as const)
    for (const [where, page] of drawings(
      "product/account/connect-desktop" + state,
    )) {
      assert.deepEqual(heading(page), [title, line], where);
      assert.deepEqual(actions(page), drawn, where);
      // A link without one valid challenge sends no request, so its line says
      // where to start again and no reference is disclosed.
      assert.equal(
        page.html.includes("Sign in again from the Mokly app."),
        state === "/empty",
        where,
      );
      assert.equal(
        page.html.includes("<summary>Details</summary>"),
        state === "/error",
        where,
      );
    }
});

/** Every link on the page, as its text and where it leads. */
function pageLinks(page: DrawnPage): [string, string | undefined][] {
  return elements(page.main, (element) => element.tagName === "a").map(
    (link) => [label(link), destination(link)],
  );
}

test("Open Mokly's request waits on its own control and inserts nothing", () => {
  for (const [viewport, scheme] of views) {
    const where = viewport + " " + scheme;
    const resting = drawnPage(
      "product/account/connect-desktop",
      viewport,
      scheme,
    );
    const opening = drawnPage(
      "product/account/connect-desktop/loading",
      viewport,
      scheme,
    );
    // The same controls in the same order: only Open Mokly changed, and it
    // shows its working word, busy, while screen readers hear the operation.
    assert.deepEqual(
      actions(opening),
      actions(resting).map(([tone, name]) => [
        tone,
        name === "Open Mokly" ? "Opening…" : name,
      ]),
      where,
    );
    assert.deepEqual(busyActions(opening), ["Opening…"], where);
    assert.deepEqual(
      pendingLabels(opening),
      [["Opening Mokly…", "screen-reader-only"]],
      where,
    );
    assert.deepEqual(byClass(opening.main, "fo-wait"), [], where);
    assert.deepEqual(heading(opening), heading(resting), where);
    // Use another account keeps its way, and the busy control leads nowhere.
    assert.deepEqual(
      pageLinks(opening),
      pageLinks(resting).filter(([name]) => name !== "Open Mokly"),
      where,
    );
  }
});

test("while the session read runs, the connect page draws its confirmation waiting", () => {
  for (const [viewport, scheme] of views) {
    const where = viewport + " " + scheme;
    const page = drawnPage(
      "product/account/connect-desktop/session-loading",
      viewport,
      scheme,
    );
    const resting = drawnPage(
      "product/account/connect-desktop",
      viewport,
      scheme,
    );
    const region = waitRegion(page, where);
    // The line under the title names the account the session decides, so it
    // names the read in its place, once.
    assert.deepEqual(
      pendingLabels(page),
      [["Loading your account…", "visible"]],
      where,
    );
    assert.equal(
      byClass(only(region, "fo-account-detail"), "fo-pending-label").length,
      1,
      where,
    );
    assert.ok(!label(page.main).includes(onboarding.email), where);
    // Both controls are known, so they draw themselves, disabled, and lead
    // nowhere until the session answers.
    assert.deepEqual(
      controlStates(region),
      [
        ["Open Mokly", true],
        ["Use another account", true],
      ],
      where,
    );
    assert.deepEqual(
      pageLinks(page),
      pageLinks(resting).filter(
        ([name]) => name !== "Open Mokly" && name !== "Use another account",
      ),
      where,
    );
    // The reader is not known yet, so the header, which comes before the
    // landmark, holds the identity's placeholder, hidden from assistive
    // technology.
    assert.match(
      page.html,
      /<header class="fo-account-header"><div class="review-account" aria-hidden="true">/,
      where,
    );
  }
});

test("the window's landing returns to the window's entry", () => {
  for (const id of [
    "product/account/callback/desktop-expired",
    "product/account/callback/desktop-expired/failure",
  ])
    for (const [where, page] of drawings(id))
      assert.deepEqual(
        links(page, "Back to sign in").map(destination),
        ["product/account/sign-in/desktop"],
        where,
      );
});

test("no desktop sign-in drawing shows the grant, the verifier or the scheme address", () => {
  for (const id of [
    "product/account/sign-in/desktop",
    "product/account/sign-in/desktop/waiting",
    "product/account/sign-up/desktop",
    "product/account/sign-up/desktop/waiting",
    "product/account/connect-desktop",
    "product/account/connect-desktop/empty",
    "product/account/connect-desktop/loading",
    "product/account/connect-desktop/error",
    "product/account/connect-desktop/opened",
    "product/account/connect-desktop/session-loading",
    "product/account/callback/desktop-expired",
    "product/account/callback/desktop-expired/failure",
  ])
    for (const [where, page] of drawings(id)) {
      assert.ok(!page.html.includes("mokly://"), where + " scheme address");
      assert.doesNotMatch(
        label(page.main),
        /grant|verifier|\b[0-9a-f]{64}\b/i,
        where,
      );
    }
});
