import assert from "node:assert/strict";
import { test } from "node:test";

import { createDrafts, draftKey } from "../../settings/drafts";

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
