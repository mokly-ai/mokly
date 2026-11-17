import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availablePanes,
  isPaneId,
  panes,
  resolvePane,
  sections,
} from "../settings/panes";
import { paneQuery, paneRoute } from "../settings/routes";

import { scope } from "./settings/scope";

test("every pane is registered once, in one of the three sections", () => {
  assert.equal(new Set(panes.map((pane) => pane.id)).size, panes.length);
  assert.equal(panes.length, 9);
  for (const pane of panes) {
    assert.ok(sections.includes(pane.section), pane.section);
  }
});

test("the route and query forms address the same pane", () => {
  const routes = {
    account: "/settings/account",
    workspace: "/acme/-/settings",
    github: "/acme/-/settings/github",
    members: "/acme/-/settings/members",
    billing: "/acme/-/settings/billing",
    project: "/acme/website/settings",
    tokens: "/acme/website/settings/tokens",
    access: "/acme/website/settings/access",
    danger: "/acme/website/settings/danger",
  };
  for (const pane of panes) {
    assert.equal(paneRoute(pane.id, scope), routes[pane.id], pane.id);
    assert.equal(
      paneQuery("/acme/website", pane.id),
      `/acme/website?settings=${pane.id}`,
    );
  }
  assert.equal(paneRoute("sections", scope), "/settings");
  assert.equal(
    paneQuery("/acme/website", "sections"),
    "/acme/website?settings=",
  );
});

test("project panes appear only when a project is in scope", () => {
  const withoutProject = availablePanes({
    workspace: true,
    project: false,
    role: "owner",
  });
  assert.deepEqual(
    withoutProject.map((pane) => pane.id),
    ["account", "workspace", "github", "members", "billing"],
  );
  const alone = availablePanes({
    workspace: false,
    project: false,
    role: undefined,
  });
  assert.deepEqual(
    alone.map((pane) => pane.id),
    ["account"],
  );
  const projectOnly = availablePanes({
    workspace: false,
    project: true,
    role: undefined,
  });
  assert.deepEqual(
    projectOnly.map((pane) => pane.id),
    ["account", "project", "tokens", "access", "danger"],
  );
  assert.equal(
    paneRoute("tokens", {
      workspaceSlug: "private-workspace",
      projectSlug: "project-guest",
    }),
    "/private-workspace/project-guest/settings/tokens",
  );
});

test("billing is a workspace pane only owners and admins are shown", () => {
  const scope = { workspace: true, project: true };
  for (const role of ["owner", "admin"] as const) {
    assert.ok(
      availablePanes({ ...scope, role }).some((pane) => pane.id === "billing"),
      role,
    );
  }
  for (const role of ["member", "reviewer"] as const) {
    assert.ok(
      !availablePanes({ ...scope, role }).some((pane) => pane.id === "billing"),
      role,
    );
  }
  // A surface that has resolved no workspace has no role to answer with,
  // and shows no workspace pane at all.
  assert.ok(
    !availablePanes({ ...scope, role: undefined }).some(
      (pane) => pane.id === "billing",
    ),
  );
});

test("every workspace role reads the GitHub accounts pane", () => {
  for (const role of ["owner", "admin", "member", "reviewer"] as const) {
    assert.ok(
      availablePanes({ workspace: true, project: false, role }).some(
        (pane) => pane.id === "github",
      ),
      role,
    );
  }
  // A project-only guest has no workspace access, so no workspace pane.
  assert.ok(
    !availablePanes({ workspace: false, project: true, role: undefined }).some(
      (pane) => pane.id === "github",
    ),
  );
  assert.equal(
    paneRoute("github", { workspaceSlug: "acme" }),
    "/acme/-/settings/github",
  );
});

test("a member asking for billing opens a pane they may read", () => {
  const forMember = availablePanes({
    workspace: true,
    project: true,
    role: "member",
  });
  assert.equal(resolvePane("billing", forMember), "account");
  const forAdmin = availablePanes({
    workspace: true,
    project: true,
    role: "admin",
  });
  assert.equal(resolvePane("billing", forAdmin), "billing");
});

test("an empty value shows the index and an unknown one opens the first pane", () => {
  const available = availablePanes({
    workspace: true,
    project: true,
    role: "owner",
  });
  assert.equal(resolvePane("", available), "sections");
  assert.equal(resolvePane(undefined, available), "sections");
  assert.equal(resolvePane("tokens", available), "tokens");
  assert.equal(resolvePane("nonsense", available), "account");
  assert.equal(
    resolvePane(
      "tokens",
      availablePanes({ workspace: true, project: false, role: "owner" }),
    ),
    "account",
  );
});

test("only registered identifiers are pane values", () => {
  assert.equal(isPaneId("danger"), true);
  assert.equal(isPaneId("workspace"), true);
  assert.equal(isPaneId("sections"), false);
  assert.equal(isPaneId("organization"), false);
});
