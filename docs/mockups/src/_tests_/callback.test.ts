/**
 * The callback landings: the protocol-named states of the email and preview
 * callbacks, the desktop handoff the email landing draws in a browser when the
 * desktop app requested the link, and the GitHub installation landings' waits,
 * their request and their two install recovery states.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parseFragment } from "parse5";

import {
  callbackLandingPages,
  callbackLandingScreens,
} from "./callback-landings";
import { catalogueEntries } from "./catalogue-index";
import { screenFile } from "./catalogue-paths";
import { drawnPalette } from "./catalogue-reads";
import { screenVariantLimit, variantParent } from "./catalogue-variants";
import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import { drawnPage, pendingLabels } from "./drawn-page";
import {
  inventoryPages,
  productInventoryViolations,
} from "./product-inventory";

test("the callback landing owns every protocol state in screens of at most four variants", () => {
  const entries = catalogueEntries();
  for (const screen of callbackLandingScreens) {
    assert.ok(screen.variants.length <= screenVariantLimit, screen.path);
    const entry = entries.find((candidate) => candidate.path === screen.path);
    assert.equal(entry?.kind, "screen", screen.path);
    assert.equal(entry && variantParent(entry), undefined, screen.path);
    assert.deepEqual(
      entry?.path.split("/").slice(0, 3),
      ["product", "account", "callback"],
      screen.path,
    );
    assert.deepEqual(
      entries
        .filter((candidate) => variantParent(candidate) === screen.path)
        .map(({ path }) => path),
      [...screen.variants],
      screen.path,
    );
  }
  for (const page of callbackLandingPages)
    assert.ok(
      productInventoryViolations(
        entries.filter((entry) => entry.path !== page.path),
        drawnPalette,
      ).length,
      page.path,
    );

  const requestAnother = "Request another sign-in link";
  const expected = [
    {
      id: "product/account/callback",
      title: "Signing you in",
      message: undefined,
      actions: [] as string[],
      details: false,
    },
    {
      id: "product/account/callback/email-invalid",
      title: "This link isn’t valid",
      message: "Request another sign-in link",
      actions: ["Back to sign in"],
      details: true,
    },
    {
      id: "product/account/callback/email-invalid/expired",
      title: "This link has expired",
      message: "Request another sign-in link",
      actions: ["Back to sign in"],
      details: true,
    },
    {
      id: "product/account/callback/email-invalid/used",
      title: "This link has already been used",
      message: "Request another sign-in link",
      actions: ["Back to sign in"],
      details: true,
    },
    {
      id: "product/account/callback/email-invalid/failure",
      title: "We couldn’t sign you in",
      message: "Request another sign-in link",
      actions: ["Back to sign in"],
      details: true,
    },
    {
      id: "product/account/callback/preview-invalid",
      title: "This link isn’t valid",
      message: undefined,
      actions: ["Back to sign in"],
      details: true,
    },
    {
      id: "product/account/callback/preview-invalid/failure",
      title: "We couldn’t sign you in",
      message: undefined,
      actions: ["Try again", "Back to sign in"],
      details: true,
    },
    {
      id: "product/account/callback/desktop",
      title: "Finish signing in",
      message: "You requested this link from the Mokly app.",
      actions: ["Open Mokly", "Continue in browser"],
      details: false,
    },
    // Nothing reached Mokly, so a request waiting for approval quotes nothing.
    {
      id: "product/account/callback/install-requested",
      title: "Installation requested",
      message: "An owner of the GitHub organization approves it on GitHub.",
      actions: ["Back to install"],
      details: false,
    },
    {
      id: "product/account/callback/install-conflict",
      title: "This GitHub account is connected to another workspace",
      message: "Remove it from that workspace first.",
      actions: ["Back to install"],
      details: true,
    },
    {
      id: "product/account/callback/install-denied",
      title: "You don’t administer this GitHub account",
      message: undefined,
      actions: ["Back to install"],
      details: true,
    },
    // While they complete the installation, the landings offer nothing.
    {
      id: "product/account/callback/install-setup",
      title: "Install the Mokly app",
      message: undefined,
      actions: [],
      details: false,
    },
    {
      id: "product/account/callback/install-authorize",
      title: "GitHub installation",
      message: undefined,
      actions: [],
      details: false,
    },
  ];
  for (const state of expected) {
    const page = inventoryPages().find((entry) => entry.path === state.id);
    assert.ok(page, state.id);
    const html = readFileSync(screenFile(page.path, "desktop"), "utf8");
    assert.ok(html.includes("<h1>" + state.title + "</h1>"), state.id);
    assert.equal(
      html.includes(requestAnother),
      state.message === requestAnother,
      state.id,
    );
    if (state.message) assert.ok(html.includes(state.message), state.id);
    assert.equal(
      html.includes("<summary>Details</summary>"),
      state.details,
      state.id,
    );
    assert.equal(
      html.match(/data-testid="firna-button-/g)?.length ?? 0,
      state.actions.length,
      state.id,
    );
    for (const action of state.actions)
      assert.ok(html.includes(action), state.id + " " + action);
  }
});

test("the desktop handoff offers the app first and draws no credential", () => {
  for (const view of ["mobile", "desktop"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const id = "product/account/callback/desktop " + view + " " + scheme;
      const html = readFileSync(
        screenFile("product/account/callback/desktop", view, scheme),
        "utf8",
      );
      const page = parseFragment(html.slice(html.indexOf("<main")));
      const actions = elements(page, (element) =>
        /^firna-button-[a-z]+$/.test(attribute(element, "data-testid") ?? ""),
      ).map((element) => [
        attribute(element, "data-testid")?.replace("firna-button-", ""),
        label(element),
      ]);
      assert.deepEqual(
        actions,
        [
          ["primary", "Open Mokly"],
          ["secondary", "Continue in browser"],
        ],
        id,
      );
      assert.ok(!html.includes("mokly://"), id + " draws no scheme address");
      assert.ok(!/token/i.test(label(page)), id + " draws no credential");
    }
});

test("the pending landing says Signing you in only in its heading and keeps its placeholder", () => {
  for (const view of ["mobile", "desktop"] as const) {
    const page = drawnPage("product/account/callback", view);
    // The heading names the operation, so the name is heard and not repeated.
    assert.deepEqual(
      pendingLabels(page),
      [["Signing you in…", "screen-reader-only"]],
      view,
    );
    const [region, ...more] = byClass(page.main, "fo-wait");
    assert.equal(more.length, 0, view);
    assert.equal(attribute(region, "aria-busy"), "true", view);
    // The success replaces the route, so the wait is one state card.
    assert.equal(byClass(region, "fo-wait-state").length, 1, view);
  }
});

test("a GitHub installation landing names Completing installation in its placeholder card", () => {
  for (const id of [
    "product/account/callback/install-setup",
    "product/account/callback/install-authorize",
  ])
    for (const view of ["mobile", "desktop"] as const) {
      const page = drawnPage(id, view);
      // Neither heading names the operation, so the card's title shows it.
      assert.deepEqual(
        pendingLabels(page),
        [["Completing installation…", "visible"]],
        id + " " + view,
      );
      const [region, ...more] = byClass(page.main, "fo-wait");
      assert.equal(more.length, 0, id + " " + view);
      assert.equal(attribute(region, "aria-busy"), "true", id + " " + view);
      // The success leaves the landing, so the wait is one state card.
      const [card, ...cards] = byClass(region, "fo-wait-state");
      assert.equal(cards.length, 0, id + " " + view);
      assert.deepEqual(
        byClass(card, "fo-wait-title").map(label),
        ["Completing installation…"],
        id + " " + view,
      );
    }
});
