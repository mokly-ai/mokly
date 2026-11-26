import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalWorkspaceAddress,
  canonicalWorkspaceWorkingRoute,
  canonicalProjectAddress,
  canonicalProjectPermalink,
  canonicalProjectWorkingRoute,
} from "../navigation/canonical";

test("retired workspace and project slugs keep tail and query bytes", () => {
  assert.equal(
    canonicalWorkspaceAddress(
      "/old/-/settings/members",
      "?settings=members&tag=a&tag=b",
      "new org",
    ),
    "/new%20org/-/settings/members?settings=members&tag=a&tag=b",
  );
  assert.equal(
    canonicalProjectAddress(
      "/old-org/old-project/publications/p1/",
      "?tag=a&tag=b&catalogueScreen=start",
      "new-org",
      "new-project",
    ),
    "/new-org/new-project/publications/p1/?tag=a&tag=b&catalogueScreen=start",
  );
});

test("settings renames rewrite only a working route that names the subject", () => {
  assert.equal(
    canonicalWorkspaceWorkingRoute(
      "/old-org/project/settings",
      "?settings=workspace",
      "old-org",
      "new-org",
    ),
    "/new-org/project/settings?settings=workspace",
  );
  assert.equal(
    canonicalWorkspaceWorkingRoute(
      "/install",
      "?workspaceId=org-id&settings=workspace",
      "old-org",
      "new-org",
    ),
    "/install?workspaceId=org-id&settings=workspace",
  );
  assert.equal(
    canonicalProjectWorkingRoute(
      "/org/old-project/publications/p1",
      "?settings=project&tag=one&tag=two",
      "org",
      "old-project",
      "org",
      "new-project",
    ),
    "/org/new-project/publications/p1?settings=project&tag=one&tag=two",
  );
  assert.equal(
    canonicalProjectWorkingRoute(
      "/settings/account",
      "?settings=project&settingsProject=project-id",
      "org",
      "old-project",
      "org",
      "new-project",
    ),
    "/settings/account?settings=project&settingsProject=project-id",
  );
});

test("a UUID permalink keeps viewer selection while replacing its prefix", () => {
  const project = {
    id: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    workspaceSlug: "mokly",
    slug: "cloud",
    name: "Mokly Cloud",
    repository: "mokly-ai/mokly-cloud",
    configPath: "mokly.config.json",
    visibility: "private",
    requireApproval: false,
    canAdmin: true,
    publishingAllowed: true,
    automaticBuilds: false,
    buildsAvailable: false,
    canRequestBuilds: false,
    version: 1,
  } as const;
  assert.equal(
    canonicalProjectPermalink(
      "/projects/00000000-0000-0000-0000-000000000001/publications/p1",
      "?view=changes&tag=one&tag=two",
      project,
    ),
    "/mokly/cloud/publications/p1?view=changes&tag=one&tag=two",
  );
  // A build's permalink keeps its tail and its open panel the same way.
  assert.equal(
    canonicalProjectPermalink(
      "/projects/00000000-0000-0000-0000-000000000001/builds/b1",
      "?panel=history",
      project,
    ),
    "/mokly/cloud/builds/b1?panel=history",
  );
});
