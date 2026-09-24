import assert from "node:assert/strict";
import test from "node:test";

import { baselineCatalogue } from "../dist/baseline/catalogue.js";
import {
  childUpdateMessage,
  parseChildUpdateMessage,
} from "../dist/server/update_messages.js";

test("watch update messages preserve available and unavailable route state", () => {
  assert.deepEqual(childUpdateMessage(2, ["screens/home.html"]), {
    changedRoutes: ["screens/home.html"],
    componentChanges: null,
    type: "update",
    version: 2,
  });
  assert.deepEqual(childUpdateMessage(3, undefined), {
    changedRoutes: null,
    componentChanges: null,
    type: "update",
    version: 3,
  });
  assert.deepEqual(
    parseChildUpdateMessage({
      changedRoutes: [],
      componentChanges: null,
      type: "update",
      version: 4,
    }),
    {
      changedRoutes: [],
      componentChanges: null,
      type: "update",
      version: 4,
    },
  );
});

test("watch update parsing rejects incomplete or unsafe IPC values", () => {
  for (const value of [
    null,
    { ...childUpdateMessage(2, undefined), kind: "unknown" },
    { ...childUpdateMessage(2, undefined), kind: null },
    { ...childUpdateMessage(2, undefined), changesStatus: "unknown" },
    { ...childUpdateMessage(2, undefined), changesStatus: null },
    { changedRoutes: null, componentChanges: null, type: "reload", version: 2 },
    { changedRoutes: null, componentChanges: null, type: "update", version: 0 },
    {
      changedRoutes: null,
      componentChanges: null,
      type: "update",
      version: 1.5,
    },
    {
      changedRoutes: undefined,
      componentChanges: null,
      type: "update",
      version: 2,
    },
    {
      changedRoutes: ["../home.html"],
      componentChanges: null,
      type: "update",
      version: 2,
    },
    { changedRoutes: [42], componentChanges: null, type: "update", version: 2 },
    { changedRoutes: null, type: "update", version: 2 },
  ]) {
    assert.equal(parseChildUpdateMessage(value), undefined);
  }
});

test("watch updates preserve explicit Changes loading and terminal states", () => {
  for (const status of [
    "preparing",
    "pending",
    "ready",
    "unavailable",
  ] as const) {
    const message = childUpdateMessage(
      2,
      status === "ready" ? [] : undefined,
      undefined,
      status,
    );
    assert.equal(message.changesStatus, status);
    assert.deepEqual(parseChildUpdateMessage(message), message);
  }
});

test("watch updates distinguish evidence from content without guessing from Changes status", () => {
  for (const kind of ["content", "evidence"] as const) {
    for (const status of [
      "preparing",
      "pending",
      "ready",
      "unavailable",
    ] as const) {
      const message = childUpdateMessage(
        2,
        status === "ready" ? [] : undefined,
        undefined,
        status,
        kind,
      );
      assert.equal(message.kind, kind);
      assert.deepEqual(parseChildUpdateMessage(message), message);
    }
  }
});

test("baseline handoffs preserve pinned commits and explicit revocation", () => {
  for (const commit of ["a".repeat(40), "b".repeat(64), null]) {
    const message = childUpdateMessage(
      2,
      undefined,
      undefined,
      "pending",
      "evidence",
      commit,
      commit === null ? undefined : "blobs",
      commit === null
        ? undefined
        : baselineCatalogue(commit, "mockups", "generated-v6"),
    );
    assert.equal(message.baselineCommit, commit);
    assert.deepEqual(parseChildUpdateMessage(message), message);
  }
  for (const baselineCommit of [
    "HEAD",
    "../escape",
    "a".repeat(41),
    "",
    12,
    {},
  ]) {
    assert.equal(
      parseChildUpdateMessage({
        ...childUpdateMessage(2, undefined),
        baselineCommit,
      }),
      undefined,
    );
  }
});
