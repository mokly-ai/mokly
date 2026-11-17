import assert from "node:assert/strict";
import { test } from "node:test";

import { follow, leavesApplication } from "../navigation/follow";

import { tabAt, withWindow } from "./page-window";

/** A page and a router that record where each one was sent. */
function recorded() {
  const pushed: string[] = [];
  const assigned: string[] = [];
  return {
    pushed,
    assigned,
    router: { push: (href: string) => void pushed.push(href) },
    page: {
      location: {
        ...tabAt("http://localhost:8081/auth/email/callback"),
        assign: (address: string) => void assigned.push(address),
      },
    },
  };
}

const handoff = "mokly://auth/email/callback#token=" + "a".repeat(64);

test("an application route goes through the router", () => {
  const { pushed, assigned, router, page } = recorded();
  withWindow(page, () => {
    for (const href of [
      "/sign-in",
      "/sign-in?returnTo=https%3A%2F%2Fmokly.ai%2F",
      "/acme/website?settings=project",
      "?settings=account",
    ]) {
      follow(href, router);
    }
  });
  assert.deepEqual(pushed, [
    "/sign-in",
    "/sign-in?returnTo=https%3A%2F%2Fmokly.ai%2F",
    "/acme/website?settings=project",
    "?settings=account",
  ]);
  assert.deepEqual(assigned, []);
});

test("an address outside the application leaves this tab for it", () => {
  const { pushed, assigned, router, page } = recorded();
  withWindow(page, () => {
    follow(handoff, router);
    follow("https://mokly.ai/docs/publishing", router);
  });
  assert.deepEqual(assigned, [handoff, "https://mokly.ai/docs/publishing"]);
  assert.deepEqual(pushed, []);
});

test("an address that would run in the page is never followed", () => {
  const { pushed, assigned, router, page } = recorded();
  const scripted = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<p>hi</p>",
  ];
  withWindow(page, () => {
    for (const href of scripted) follow(href, router);
  });
  withWindow({}, () => {
    for (const href of scripted) follow(href, router);
  });
  assert.deepEqual(assigned, []);
  assert.deepEqual(pushed, []);
});

test("without a browser location the router takes every address", () => {
  const { pushed, router } = recorded();
  withWindow({}, () => follow(handoff, router));
  withWindow(undefined, () => follow("/sign-in", router));
  assert.deepEqual(pushed, [handoff, "/sign-in"]);
});

test("only an address with a scheme or another host leaves the application", () => {
  for (const href of [
    handoff,
    "mokly-app://desktop/dashboard",
    "https://mokly.ai/",
    "HTTP://mokly.ai/",
    "mailto:hello@mokly.ai",
    "//mokly.ai/docs",
  ]) {
    assert.equal(leavesApplication(href), true, href);
  }
  for (const href of [
    "/sign-in",
    "/auth/email/callback?client=desktop",
    "/acme/-/settings?returnTo=mokly://elsewhere",
    "?settings=account",
    "",
  ]) {
    assert.equal(leavesApplication(href), false, href);
  }
});
