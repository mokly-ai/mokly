import assert from "node:assert/strict";
import { test } from "node:test";

import { pageBeneath, paneQuery } from "../../settings/routes";

test("the dialog is addressed over the page without displacing its state", () => {
  const viewer = "/acme/website/publications/pub";
  const showing = "?view=changes&catalogueScreen=start&panel=history";
  // Opening settings keeps every key the page beneath is using, because the
  // dialog is drawn over that page rather than instead of it.
  assert.equal(
    paneQuery(viewer, "tokens", showing),
    viewer +
      "?view=changes&catalogueScreen=start&panel=history&settings=tokens",
  );
  // Switching panes replaces the value in place, never appends a second one.
  assert.equal(
    paneQuery(viewer, "access", "?view=changes&settings=tokens"),
    viewer + "?view=changes&settings=access",
  );
  assert.equal(paneQuery(viewer, "sections", ""), viewer + "?settings=");
});

test("a durable settings redirect carries its return query onto the page", () => {
  assert.equal(
    paneQuery("/acme/website", "billing", "?checkout=success&source=stripe"),
    "/acme/website?checkout=success&source=stripe&settings=billing",
  );
});

test("a redirect onto a page with its own query joins that query", () => {
  // The install step is addressed by its workspace, so a dialog redirected
  // over it extends the page's query rather than starting a second one.
  assert.equal(
    paneQuery("/install?workspaceId=org-1", "billing", "?checkout=success"),
    "/install?workspaceId=org-1&checkout=success&settings=billing",
  );
  // The page's own value stands when the carried query names the same key.
  assert.equal(
    paneQuery("/install?workspaceId=org-1", "account", "?workspaceId=org-2"),
    "/install?workspaceId=org-1&settings=account",
  );
});

test("settings edits only its own query pair", () => {
  const viewer = "/acme/website/publications/pub";
  const search =
    "?view=changes&handoff=one%26two+literal%2Bplus%23notes" +
    "&tag=first&tag=second&settings=account";
  const beneath =
    "view=changes&handoff=one%26two+literal%2Bplus%23notes" +
    "&tag=first&tag=second";

  assert.equal(
    paneQuery(viewer, "tokens", search),
    `${viewer}?${beneath}&settings=tokens`,
  );
  assert.equal(pageBeneath(viewer, search), `${viewer}?${beneath}`);
});

test("closing settings returns to the page it was drawn over", () => {
  const viewer = "/acme/website/publications/pub";
  assert.equal(
    pageBeneath(viewer, "?view=changes&settings=tokens"),
    viewer + "?view=changes",
  );
  // Nothing else was on the page, so nothing is left behind on the address.
  assert.equal(pageBeneath(viewer, "?settings="), viewer);
  assert.equal(pageBeneath(viewer, ""), viewer);
});
