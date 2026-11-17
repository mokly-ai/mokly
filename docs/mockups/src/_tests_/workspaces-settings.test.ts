/**
 * The workspace model's settings drawings: the GitHub accounts pane with its
 * rows, menu and removal, and the Workspace pane's one GitHub accounts fact.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { githubAccounts } from "../fixtures/product";

import {
  attribute,
  byClass,
  elements,
  label,
} from "./design-site-test-helpers";
import {
  actions,
  destination,
  drawnPage,
  facts,
  links,
  pendingLabels,
} from "./drawn-page";
import type { DrawnPage } from "./drawn-page";

const viewports = ["desktop", "mobile"] as const;
const pane = (slug = "") =>
  "product/settings/github" + (slug ? "/" + slug : "");

/** Each account row's name, its kind and whether it says it is suspended. */
function rows(page: DrawnPage): [string, string, boolean][] {
  return byClass(page.main, "fo-note").map((row) => [
    label(byClass(row, "fo-note-title")[0]),
    label(byClass(row, "fo-note-detail")[0]),
    elements(row, (element) =>
      (attribute(element, "data-testid") ?? "").startsWith("firna-badge-"),
    ).some((badge) => label(badge) === "Suspended"),
  ]);
}

/** The names of the row menus' triggers, and whether each is open. */
function menus(page: DrawnPage): [string, string][] {
  return elements(
    page.main,
    (element) =>
      attribute(element, "data-testid") === "firna-responsive-menu-trigger",
  ).map((trigger) => [
    attribute(trigger, "aria-label") ?? "",
    attribute(trigger, "aria-expanded") ?? "",
  ]);
}

test("the GitHub accounts pane lists every account, and its actions are an administrator's", () => {
  const listed: [string, string, boolean][] = githubAccounts.map((account) => [
    account.name,
    account.kind,
    false,
  ]);
  const closed = githubAccounts.map((account): [string, string] => [
    "Actions for " + account.name,
    "false",
  ]);
  for (const viewport of viewports) {
    const owner = drawnPage(pane(), viewport);
    assert.ok(
      owner.html.includes('<h1 class="fo-dialog-title">GitHub accounts</h1>'),
    );
    assert.ok(owner.html.includes(">Connected accounts<"));
    assert.deepEqual(rows(owner), listed);
    assert.deepEqual(menus(owner), closed);
    assert.deepEqual(actions(owner).slice(-1), [
      ["secondary", "Add GitHub account"],
    ]);
    assert.deepEqual(links(owner, "Resume on GitHub"), []);

    const member = drawnPage(pane("member"), viewport);
    assert.deepEqual(rows(member), listed);
    assert.deepEqual(menus(member), []);
    assert.ok(!member.html.includes("Add GitHub account"));

    const suspended = drawnPage(pane("suspended"), viewport);
    assert.deepEqual(
      rows(suspended),
      listed.map(([name, kind], index) => [name, kind, index === 0]),
    );
    const [resume, ...more] = links(suspended, "Resume on GitHub");
    assert.equal(more.length, 0);
    assert.equal(attribute(resume, "href"), githubAccounts[0].manageUrl);
    assert.equal(attribute(resume, "target"), "_blank");
  }
});

test("a row menu opens with Manage on GitHub and Remove, and removing asks first", () => {
  for (const viewport of viewports) {
    const open = drawnPage(pane("menu"), viewport);
    assert.deepEqual(menus(open), [
      ["Actions for " + githubAccounts[0].name, "true"],
      ["Actions for " + githubAccounts[1].name, "false"],
    ]);
    const items = elements(
      open.main,
      (element) => attribute(element, "role") === "menuitem",
    ).map(label);
    assert.deepEqual(items, ["Manage on GitHub", "Remove"]);

    const asked = drawnPage(pane("remove"), viewport);
    assert.ok(asked.html.includes("Remove " + githubAccounts[0].name + "?"));
    assert.ok(
      asked.html.includes(
        "Mokly stops reading its repositories. Its projects and publications stay.",
      ),
    );
    assert.deepEqual(actions(asked).slice(-2), [
      ["danger", "Remove"],
      ["quiet", "Cancel"],
    ]);
    assert.deepEqual(links(asked, "Cancel").map(destination), [pane()]);

    const working = drawnPage(pane("remove/loading"), viewport);
    assert.deepEqual(actions(working).slice(-2), [
      ["danger", "Removing…"],
      ["quiet", "Cancel"],
    ]);
    assert.ok(working.html.includes('aria-busy="true"'));
    // Removing… already says it on screen, so the busy region is heard only.
    assert.deepEqual(pendingLabels(working), [
      ["Removing GitHub account…", "screen-reader-only"],
    ]);
  }
});

test("the GitHub accounts pane says when it has none, is loading or could not load", () => {
  for (const viewport of viewports) {
    const none = drawnPage(pane("empty"), viewport);
    assert.ok(none.html.includes(">No GitHub accounts yet<"));
    assert.deepEqual(actions(none).slice(-1), [
      ["primary", "Add GitHub account"],
    ]);
    const loading = drawnPage(pane("loading"), viewport);
    assert.ok(loading.html.includes("Loading GitHub accounts"));
    assert.ok(loading.html.includes('aria-busy="true"'));
    const failed = drawnPage(pane("error"), viewport);
    assert.ok(failed.html.includes(">GitHub accounts couldn’t load<"));
    assert.deepEqual(actions(failed).slice(-1), [["primary", "Try again"]]);
    assert.ok(failed.html.includes("<summary>Details</summary>"));
  }
});

test("the Workspace pane names its GitHub accounts in one fact, and only administrators manage them", () => {
  const named = githubAccounts.map((account) => account.name).join(", ");
  for (const viewport of viewports)
    for (const [slug, value, manages, next] of [
      ["", named, true, "product/account/choose-repository"],
      ["empty", named, true, "product/account/choose-repository"],
      [
        "suspended",
        githubAccounts[0].name + " · Suspended",
        true,
        "product/account/install-app",
      ],
      ["absent", "None", true, "product/account/install-app"],
      ["plan", named, true, "product/account/choose-repository"],
      ["plan-member", named, false, "product/account/choose-repository"],
    ] as const) {
      const id = "product/settings/workspace" + (slug ? "/" + slug : "");
      const page = drawnPage(id, viewport);
      assert.deepEqual(
        facts(page).map(([term]) => term),
        ["Plan", "Slug", "GitHub accounts"],
        id,
      );
      const fact = facts(page).find(([term]) => term === "GitHub accounts");
      assert.equal(fact?.[1], value + (manages ? "Manage" : ""), id);
      assert.deepEqual(
        links(page, "Manage").map(destination),
        manages ? ["product/settings/github"] : [],
        id,
      );
      assert.ok(!page.html.includes("Manage installation"), id);
      assert.ok(!page.html.includes("Resume on GitHub"), id);
      assert.deepEqual(
        links(page, "Create project").map(destination),
        [next],
        id,
      );
    }
});

test("the settings index and the rail list the GitHub accounts pane after the Workspace pane", () => {
  const rail = drawnPage("product/settings/workspace", "desktop");
  const entries = elements(
    rail.main,
    (element) => attribute(element, "class") === "fo-nav-item",
  ).map(label);
  assert.deepEqual(entries.slice(1, 5), [
    "Workspace",
    "GitHub accounts",
    "Members",
    "Billing",
  ]);
  const index = drawnPage("product/settings/sections", "mobile");
  assert.deepEqual(
    links(index, "Open")
      .map(destination)
      .filter((path) => path?.startsWith("product/settings/")),
    [
      "product/settings/account",
      "product/settings/workspace",
      "product/settings/github",
      "product/settings/members",
      "product/settings/billing",
      "product/settings/project",
      "product/settings/tokens",
      "product/settings/access",
      "product/settings/danger",
    ],
  );
});
