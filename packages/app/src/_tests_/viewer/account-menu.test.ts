import assert from "node:assert/strict";
import { test } from "node:test";

import type { User } from "../../api/types";
import type { MenuItem } from "../../viewer/menu-list";
import type { ViewerPanel } from "../../viewer/selection";
import "../server-render";

/**
 * The menus' rows and the account's name, loaded after the doubles that
 * stand in for Expo Router and the package Button in Node.
 */
async function subjects() {
  const { moreItems } = await import("../../screens/viewer/more-menu");
  const { accountLabel } = await import("../../screens/viewer/slots");
  const { accountItems } = await import("../../viewer/account-menu");
  const { barPlacement } = await import("../../viewer/bar");
  return { moreItems, accountLabel, accountItems, barPlacement };
}

/** Each row as the reader meets it: its label, and its link's path or its press. */
function rows(items: readonly MenuItem[]): string[][] {
  return items.map((item) =>
    item.kind === "link"
      ? [item.label, "link", new URL(item.href).pathname]
      : [item.label, item.disabled ? "disabled" : "action"],
  );
}

function user(name: string, email = "jordan.mccallister@example.com"): User {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name,
    email,
    githubConnected: false,
  };
}

test("the account's items run from Settings to Sign out, with the site's Docs and Changelog between", async () => {
  const { accountItems } = await subjects();
  const pressed: string[] = [];
  const items = accountItems({
    onSettings: () => pressed.push("settings"),
    onSignOut: () => pressed.push("sign out"),
    onLeave: () => pressed.push("leave"),
  });
  assert.deepEqual(rows(items), [
    ["Settings", "action"],
    ["Docs", "link", "/docs/"],
    ["Changelog", "link", "/changelog/"],
    ["Sign out", "action"],
  ]);
  for (const item of items)
    if (item.kind === "link") item.onFollow();
    else item.onSelect();
  assert.deepEqual(pressed, ["settings", "leave", "leave", "sign out"]);
});

test("More's own rows are the project, History and Share, and Share waits for a publication", async () => {
  const { moreItems, barPlacement } = await subjects();
  const opened: ViewerPanel[] = [];
  const input = {
    placement: barPlacement(true),
    workspace: "Mokly Team",
    project: { name: "Mokly Cloud" },
    onPanel: (panel: ViewerPanel) => opened.push(panel),
  };
  const items = moreItems({ ...input, shareable: true });
  assert.deepEqual(rows(items), [
    ["Mokly Team / Mokly Cloud", "action"],
    ["History", "action"],
    ["Share", "action"],
  ]);
  for (const item of items) if (item.kind === "action") item.onSelect();
  assert.deepEqual(opened, ["projects", "history", "share"]);
  assert.deepEqual(rows(moreItems({ ...input, shareable: false }))[2], [
    "Share",
    "disabled",
  ]);
  // The full bar gives More nothing to carry.
  assert.deepEqual(
    moreItems({ ...input, placement: barPlacement(false), shareable: true }),
    [],
  );
});

test("the account names a reader by the name they set, else by their address once", async () => {
  const { accountLabel } = await subjects();
  assert.deepEqual(accountLabel(user("Charlotte Wainwright")), {
    name: "Charlotte Wainwright",
    address: "jordan.mccallister@example.com",
  });
  for (const name of ["", "jordan.mccallister@example.com"])
    assert.deepEqual(accountLabel(user(name)), {
      name: "jordan.mccallister@example.com",
    });
});
