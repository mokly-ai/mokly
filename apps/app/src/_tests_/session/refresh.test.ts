import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError, transportError } from "../../api/errors";
import type { Session } from "../../api/types";
import type { SessionState } from "../../session/context";
import { afterRefresh } from "../../session/refresh";

function session(githubConnected: boolean): Session {
  return {
    user: {
      id: "01994f10-0000-7000-8000-000000000011",
      name: "person@example.com",
      email: "person@example.com",
      githubConnected,
    },
    csrfToken: "csrf",
    workspaceIds: [],
  };
}

const signedIn: SessionState = { status: "signed-in", session: session(false) };
const signedOut: SessionState = { status: "signed-out" };

const expired = new ApiError({
  code: "unauthenticated",
  reason: "session-expired",
  message: "Sign in again.",
  requestId: "r-1",
  status: 401,
});

test("a connection made on the web replaces the session on screen", () => {
  assert.deepEqual(afterRefresh(signedIn, { session: session(true) }), {
    status: "signed-in",
    session: session(true),
  });
  assert.deepEqual(afterRefresh(signedOut, { session: session(true) }), {
    status: "signed-in",
    session: session(true),
  });
});

test("an unchanged session keeps the very state on screen", () => {
  assert.equal(afterRefresh(signedIn, { session: session(false) }), signedIn);
  assert.equal(afterRefresh(signedOut, { error: expired }), signedOut);
});

test("a session that ended signs the window out", () => {
  assert.deepEqual(afterRefresh(signedIn, { error: expired }), signedOut);
});

test("a read that failed for any other reason keeps what is on screen", () => {
  for (const error of [transportError("r-2"), undefined]) {
    assert.equal(afterRefresh(signedIn, { error }), signedIn);
    assert.equal(afterRefresh(signedOut, { error }), signedOut);
  }
});
