import assert from "node:assert/strict";
import { test } from "node:test";

import type { Role, Workspace } from "../../../api/types";
import { connectDestination } from "../../../screens/account/connect-destination";

function workspace(id: string, role: Role): Workspace {
  return {
    id,
    name: id + " Team",
    slug: id,
    role,
    plan: "free",
    githubInstallationState: "absent",
    version: 1,
  } satisfies Workspace;
}

const owned = workspace("owned", "owner");
const run = workspace("run", "admin");
const joined = workspace("joined", "member");
const read = workspace("read", "reviewer");

test("a reader who administers no workspace is offered one to create", () => {
  assert.deepEqual(connectDestination([], undefined, undefined), {
    kind: "none",
  });
  assert.deepEqual(connectDestination([joined, read], undefined, undefined), {
    kind: "none",
  });
  // A named workspace the reader only belongs to cannot take the account.
  assert.deepEqual(connectDestination([joined], "joined", undefined), {
    kind: "none",
  });
});

test("a named administered workspace is a fact", () => {
  assert.deepEqual(connectDestination([joined, run], "run", undefined), {
    kind: "fact",
    workspace: run,
  });
  assert.deepEqual(connectDestination([owned, run], "run", undefined), {
    kind: "fact",
    workspace: run,
  });
  // The address wins over an earlier choice in the select.
  assert.deepEqual(connectDestination([owned, run], "run", "owned"), {
    kind: "fact",
    workspace: run,
  });
});

test("one administered workspace is still a choice, so a new one can be made", () => {
  assert.deepEqual(connectDestination([joined, run], undefined, undefined), {
    kind: "select",
    workspace: run,
    options: [run],
  });
});

test("several administered workspaces are a choice that starts on the first", () => {
  const options = [owned, run];
  assert.deepEqual(
    connectDestination([owned, joined, run], undefined, undefined),
    { kind: "select", workspace: owned, options },
  );
  assert.deepEqual(connectDestination([owned, run], undefined, "run"), {
    kind: "select",
    workspace: run,
    options,
  });
  // A name the reader does not administer, or a stale choice, is no name.
  assert.deepEqual(connectDestination([owned, joined, run], "joined", "gone"), {
    kind: "select",
    workspace: owned,
    options,
  });
});
