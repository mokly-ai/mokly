import assert from "node:assert/strict";
import { test } from "node:test";

import { settingsPath } from "../../navigation/paths";
import { carrySettings, paneRoute } from "../../settings/routes";

test("a pane whose scope lacks a slug that it needs has no address yet", () => {
  // A workspace's panes need its slug, and a project's need both slugs.
  for (const pane of ["workspace", "github", "members", "billing"] as const)
    assert.equal(paneRoute(pane, { projectSlug: "website" }), undefined, pane);
  for (const pane of ["project", "tokens", "access", "danger"] as const) {
    assert.equal(paneRoute(pane, { workspaceSlug: "acme" }), undefined, pane);
    assert.equal(paneRoute(pane, { projectSlug: "website" }), undefined, pane);
  }
  // The index and the reader's own account need no slug.
  assert.equal(paneRoute("sections", {}), settingsPath({ pane: "sections" }));
  assert.equal(paneRoute("account", {}), settingsPath({ pane: "account" }));
});

test("an open dialog goes along to the address a page hands the reader on to", () => {
  assert.equal(
    carrySettings("/install?workspaceId=w", "?settings=github"),
    "/install?workspaceId=w&settings=github",
  );
  assert.equal(
    carrySettings(
      "/install?workspaceId=w",
      "settings=project&settingsProject=p",
    ),
    "/install?workspaceId=w&settings=project&settingsProject=p",
  );
  assert.equal(carrySettings("/install", "?settings="), "/install?settings=");
  // The dialog's keys travel byte for byte.
  assert.equal(
    carrySettings("/install", "?settings=git%68ub"),
    "/install?settings=git%68ub",
  );
});

test("only the dialog goes along, and the address's own keys win", () => {
  assert.equal(
    carrySettings(
      "/install?workspaceId=w",
      "?installationId=4&settings=github",
    ),
    "/install?workspaceId=w&settings=github",
  );
  assert.equal(
    carrySettings("/install?settings=members", "?settings=github"),
    "/install?settings=members",
  );
  assert.equal(
    carrySettings("/install?workspaceId=w", ""),
    "/install?workspaceId=w",
  );
  assert.equal(carrySettings("/install", "?installationId=4"), "/install");
});
