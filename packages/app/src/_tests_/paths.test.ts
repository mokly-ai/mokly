import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  branchPath,
  connectInstallationPath,
  createWorkspaceForPath,
  installStepPath,
  workspaceCliProjectPath,
  workspaceNewProjectPath,
  workspacePath,
  projectPath,
  projectPermalinkPath,
  projectSetupPath,
  publicationPath,
  pullRequestPath,
  settingsPath,
} from "../navigation/paths";

test("resource path builders encode each slug and identifier once", () => {
  assert.equal(workspacePath("mokly cloud"), "/mokly%20cloud");
  assert.equal(workspaceNewProjectPath("mokly"), "/mokly/-/new");
  assert.equal(projectPath("mokly", "cloud app"), "/mokly/cloud%20app");
  assert.equal(projectPermalinkPath("project/id"), "/projects/project%2Fid");
  assert.equal(projectSetupPath("mokly", "cloud"), "/mokly/cloud/setup");
  assert.equal(
    publicationPath("mokly", "cloud", "publication/id"),
    "/mokly/cloud/publications/publication%2Fid",
  );
  assert.equal(
    pullRequestPath("mokly", "cloud", 42),
    "/mokly/cloud/pull-requests/42",
  );
  assert.equal(
    branchPath("mokly", "cloud", "feature/addresses"),
    "/mokly/cloud/branches?branch=feature%2Faddresses",
  );
});

test("setup paths carry the workspace and a candidate installation", () => {
  assert.equal(installStepPath("w/1"), "/install?workspaceId=w%2F1");
  assert.equal(
    installStepPath("w1", 42),
    "/install?workspaceId=w1&installationId=42",
  );
  assert.equal(connectInstallationPath(42), "/install?installationId=42");
  assert.equal(createWorkspaceForPath(42), "/new?installationId=42");
  assert.equal(
    workspaceCliProjectPath("mokly team"),
    "/mokly%20team/-/new/cli",
  );
});

test("settings paths use root, sentinel, or project scope", () => {
  assert.equal(settingsPath({ pane: "sections" }), "/settings");
  assert.equal(settingsPath({ pane: "account" }), "/settings/account");
  assert.equal(
    settingsPath({ pane: "workspace", workspaceSlug: "mokly" }),
    "/mokly/-/settings",
  );
  assert.equal(
    settingsPath({ pane: "github", workspaceSlug: "mokly" }),
    "/mokly/-/settings/github",
  );
  assert.equal(
    settingsPath({ pane: "members", workspaceSlug: "mokly" }),
    "/mokly/-/settings/members",
  );
  assert.equal(
    settingsPath({
      pane: "tokens",
      workspaceSlug: "mokly",
      projectSlug: "cloud",
    }),
    "/mokly/cloud/settings/tokens",
  );
});

async function sourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === "_tests_" || entry.name === "generated") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(target)));
    else if (/\.tsx?$/.test(entry.name)) files.push(target);
  }
  return files;
}

test("product source builds project URLs only through navigation paths", async () => {
  const root = path.resolve(import.meta.dirname, "..");
  const owner = path.join(root, "navigation/paths.ts");
  const offenders: string[] = [];
  for (const file of await sourceFiles(root)) {
    if (file === owner) continue;
    const source = await readFile(file, "utf8");
    if (/\/projects\/\$\{/.test(source)) {
      offenders.push(path.relative(root, file));
    }
  }
  assert.deepEqual(offenders, []);
});
