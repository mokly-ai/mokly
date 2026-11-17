import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availablePanes,
  isPaneId,
  panes,
  resolvePane,
  sections,
} from "../settings/panes";
import { nonRetryable } from "../api/form-error";
import { ApiError, unexpectedError } from "../api/errors";
import { formFailure } from "../components/form-failure";
import { createDrafts, draftKey } from "../settings/drafts";
import { failureAfterInput, wayBack, writeLabel } from "../settings/write";
import { gestureHome, guardSurface, judgeGesture } from "../settings/gestures";
import { pageBeneath, paneQuery, paneRoute } from "../settings/routes";

const scope = { workspaceSlug: "acme", projectSlug: "website" };

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

function guardFor(home: string, holds: () => boolean) {
  const asked: number[] = [];
  const guard = guardSurface({
    home: () => home,
    holds,
    ask: () => asked.push(1),
  });
  guard.showing(true);
  return { guard, asked };
}

test("a gesture away from a surface on screen is held and answered", () => {
  const { guard, asked } = guardFor("/here", () => true);
  assert.deepEqual(judgeGesture("/there"), { stop: true, restore: true });
  assert.equal(asked.length, 1);
  guard.showing(false);
});

test("the move back that answers a gesture is let through", () => {
  const { guard } = guardFor("/here", () => true);
  assert.deepEqual(judgeGesture("/here"), { stop: false, restore: false });
  guard.showing(false);
});

test("a surface that leaves the screen answers nothing", () => {
  const { guard } = guardFor("/here", () => true);
  assert.equal(judgeGesture("/there").stop, true);
  guard.showing(false);
  assert.equal(judgeGesture("/there").stop, false);
  guard.showing(true);
  assert.equal(judgeGesture("/there").stop, true);
  guard.showing(false);
});

test("an exit the reader chose is let through exactly once", () => {
  const { guard, asked } = guardFor("/here", () => true);
  guard.release();
  assert.equal(judgeGesture("/there").stop, false);
  // The surface is still on screen, so the next gesture is held again: an
  // exit that turns out not to leave cannot leave the next draft undefended.
  assert.equal(judgeGesture("/there").stop, true);
  assert.equal(asked.length, 1);
  guard.showing(false);
});

test("saying a surface is on screen twice registers it once", () => {
  const { guard } = guardFor("/here", () => true);
  guard.showing(true);
  guard.showing(false);
  assert.equal(judgeGesture("/there").stop, false);
});

test("every gesture is held until the reader has answered the first", () => {
  const { guard, asked } = guardFor("/here", () => true);
  assert.equal(judgeGesture("/there").stop, true);
  assert.equal(judgeGesture("/further").stop, true);
  assert.equal(asked.length, 2);
  guard.showing(false);
});

test("a surface holding no draft never holds a gesture", () => {
  const { guard, asked } = guardFor("/here", () => false);
  assert.deepEqual(judgeGesture("/there"), { stop: false, restore: false });
  assert.equal(asked.length, 0);
  guard.showing(false);
});

test("an inner surface answers before the one it opened over", () => {
  const outer = guardFor("/outer", () => true);
  const inner = guardFor("/inner", () => false);
  assert.equal(judgeGesture("/there").stop, false);
  inner.guard.showing(false);
  assert.equal(judgeGesture("/there").stop, true);
  outer.guard.showing(false);
});

test("a held surface names the address a restore is aiming for", () => {
  const { guard } = guardFor("/here", () => true);
  assert.equal(gestureHome(), "/here");
  guard.showing(false);
  assert.equal(gestureHome(), undefined);
});

test("a surface holding nothing names no address to restore to", () => {
  const { guard } = guardFor("/here", () => false);
  assert.equal(gestureHome(), undefined);
  guard.showing(false);
});

test("text that differs from what was saved is a draft", () => {
  const drafts = createDrafts();
  drafts.measure("account:1:name", "Ada");
  assert.equal(drafts.isDirty(), false);
  drafts.hold("account:1:name", "Grace");
  assert.equal(drafts.isDirty(), true);
  assert.equal(drafts.held("account:1:name"), "Grace");
});

test("a save settles the field without the pane resetting anything", () => {
  const drafts = createDrafts();
  drafts.measure("account:1:name", "Ada");
  drafts.hold("account:1:name", "Grace Hopper");
  assert.equal(drafts.isDirty(), true);
  // The server answers with what it stored, and the pane measures against it.
  drafts.measure("account:1:name", "Grace Hopper");
  assert.equal(drafts.isDirty(), false);
  assert.equal(drafts.held("account:1:name"), undefined);
});

test("spacing the save would strip is not a draft", () => {
  const drafts = createDrafts();
  drafts.measure("account:1:name", "Ada");
  drafts.hold("account:1:name", "  Ada  ");
  assert.equal(drafts.isDirty(), false);
});

test("slug drafts preserve exact supplied text", () => {
  const drafts = createDrafts();
  drafts.measure("workspace:1:slug", "acme", [], "exact");
  drafts.hold("workspace:1:slug", " acme ");
  assert.equal(drafts.isDirty(), true);
  assert.equal(drafts.held("workspace:1:slug"), " acme ");
});

test("a draft outlives the pane that holds it", () => {
  const drafts = createDrafts();
  drafts.measure("project:p1:token-name", "");
  drafts.hold("project:p1:token-name", "Release key");
  // The compact layer hands over to the dialog: the pane goes, the words stay.
  assert.equal(drafts.held("project:p1:token-name"), "Release key");
  assert.equal(drafts.isDirty(), true);
});

test("a discard forgets every draft at once", () => {
  const drafts = createDrafts();
  drafts.measure("account:1:name", "Ada");
  drafts.hold("account:1:name", "Grace");
  drafts.hold("project:p1:token-name", "Release key");
  drafts.clear();
  assert.equal(drafts.isDirty(), false);
  assert.equal(drafts.held("account:1:name"), undefined);
});

test("text that costs nothing to lose is kept without being a question", () => {
  const drafts = createDrafts();
  const field = draftKey("project", "p1", "delete-confirmation");
  drafts.measure(field, "", ["mokly-cloud"]);
  drafts.hold(field, "mokly-clo");
  assert.equal(drafts.isDirty(), true);
  drafts.hold(field, "mokly-cloud");
  assert.equal(drafts.isDirty(), false);
  // The pane goes; the verdict is a comparison, so it does not go with it.
  assert.equal(drafts.held(field), "mokly-cloud");
  assert.equal(drafts.isDirty(), false);
});

test("two projects hold their own drafts", () => {
  const drafts = createDrafts();
  const one = draftKey("project", "p1", "token-name");
  const two = draftKey("project", "p2", "token-name");
  drafts.measure(one, "");
  drafts.measure(two, "");
  drafts.hold(one, "Release key");
  assert.equal(drafts.held(one), "Release key");
  assert.equal(drafts.held(two), undefined);
  assert.notEqual(one, two);
});

test("a draft announces itself so a guard can be put up and taken down", () => {
  const drafts = createDrafts();
  let heard = 0;
  const stop = drafts.watch(() => (heard += 1));
  drafts.hold("account:1:name", "Ada");
  drafts.hold("account:1:name", "Ada Lovelace");
  drafts.clear();
  stop();
  drafts.hold("project:p1:token-name", "Ignored");
  assert.equal(heard, 3);
});

test("a surface that leaves the screen takes its unspent release with it", () => {
  const first = guardFor("/here", () => true);
  first.guard.release();
  first.guard.showing(false);
  // The token was the first surface's; a later surface answers for itself.
  const second = guardFor("/here", () => true);
  assert.equal(judgeGesture("/there").stop, true);
  second.guard.showing(false);
});

test("a surface that left the screen never answers for one that is open", () => {
  const under = guardFor("/under", () => true);
  const over = guardFor("/over", () => true);
  // The lower surface leaves first, which moves the one above it down.
  under.guard.showing(false);
  over.guard.release();
  over.guard.showing(false);
  // Twice: a surface left behind on the stack would let the first gesture
  // through on its unspent release and only answer for the second, so a test
  // that asked once would pass against exactly the defect it is named for.
  assert.deepEqual(judgeGesture("/elsewhere"), { stop: false, restore: false });
  assert.deepEqual(judgeGesture("/elsewhere"), { stop: false, restore: false });
  assert.equal(over.asked.length, 0);
});

test("a control at rest reads its own resting label", () => {
  const resting = { pending: false, error: undefined };
  assert.equal(writeLabel(resting, "Save role", "Saving…"), "Save role");
  assert.equal(writeLabel(resting, "Remove", "Removing…"), "Remove");
});

test("a control names its own operation while it runs", () => {
  const working = { pending: true, error: undefined };
  assert.equal(writeLabel(working, "Save role", "Saving…"), "Saving…");
});

test("only the write that failed offers the way back", () => {
  const failed = { pending: false, error: unexpectedError() };
  const resting = { pending: false, error: undefined };
  // The failure belongs to one control's write, so the other control beside
  // it still reads its own label: a retry can never invoke the neighbour.
  assert.equal(writeLabel(failed, "Remove", "Removing…"), "Try again");
  assert.equal(writeLabel(resting, "Save role", "Saving…"), "Save role");
});

test("a refusal the reader must answer keeps the control's label", () => {
  const answered = { pending: false, error: unexpectedError(), answered: true };
  // The cause is on the field the reader can change; the same request cannot
  // succeed until they change it, so the control still names what it does.
  assert.equal(writeLabel(answered, "Save role", "Saving…"), "Save role");
  assert.equal(
    writeLabel({ ...answered, pending: true }, "Save role", "Saving…"),
    "Saving…",
  );
});

test("a non-retryable refusal keeps the control's label", () => {
  assert.deepEqual(
    [...nonRetryable],
    [
      "plan-required",
      "builds-unavailable",
      "build-ineligible",
      "subscription-active",
      "permission-denied",
      "duplicate-project",
      "last-owner",
      "already-member",
      "invitation-expired",
    ],
  );
  for (const reason of nonRetryable) {
    const error = new ApiError({
      code: "failed-precondition",
      reason,
      message: "The same request will be refused again.",
      requestId: "01994f10-0000-7000-8000-0000000000bb",
      status: 400,
    });
    const failure = formFailure({ pending: false, error }, {});
    assert.equal(
      failure.label("Make change", "Making change…"),
      "Make change",
      reason,
    );
  }
});

test("a screen may name the way back it offers", () => {
  const failed = { pending: false, error: unexpectedError() };
  assert.equal(writeLabel(failed, "Create workspace", "Creating…"), wayBack);
  assert.equal(
    writeLabel(failed, "Create workspace", "Creating…", "Start again"),
    "Start again",
  );
});

test("a failure is forgotten when its input is undone", () => {
  const failure = unexpectedError();
  // The reader put the role back the way it was: there is no longer an attempt
  // for the failure to describe, so the notice and its way back go too.
  assert.equal(failureAfterInput(failure, false), undefined);
});

test("a failure stays while the input still differs", () => {
  const failure = unexpectedError();
  assert.equal(failureAfterInput(failure, true), failure);
});

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
