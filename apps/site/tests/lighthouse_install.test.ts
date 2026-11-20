import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { repositoryPath, sitePath } from "../src/workspace.js";

test("Lighthouse uses exact dependencies in the single workspace lock", async () => {
  const root = JSON.parse(
    await readFile(repositoryPath("package.json"), "utf8"),
  ) as { workspaces: string[] };
  assert.deepEqual(
    root.workspaces.filter(
      (workspace) =>
        workspace === "apps/site" || workspace.startsWith("apps/site/"),
    ),
    ["apps/site"],
  );
  const lock = JSON.parse(
    await readFile(repositoryPath("package-lock.json"), "utf8"),
  ) as {
    packages: Record<
      string,
      { version?: string; devDependencies?: Record<string, string> }
    >;
  };
  const site = JSON.parse(await readFile(sitePath("package.json"), "utf8")) as {
    devDependencies: Record<string, string>;
  };
  for (const name of ["chrome-launcher", "lighthouse"]) {
    const version = site.devDependencies[name];
    assert.ok(version, `${name} is not a direct site dependency`);
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.ok(
      Object.entries(lock.packages).some(
        ([location, entry]) =>
          location.endsWith(`node_modules/${name}`) &&
          entry.version === version,
      ),
      `${name}@${version} is absent from the workspace lock`,
    );
  }
});

test("the runner imports the workspace tools directly", async () => {
  const source = await readFile(sitePath("scripts", "lighthouse.mjs"), "utf8");
  assert.match(source, /from "lighthouse"/);
  assert.match(source, /from "chrome-launcher"/);
  assert.doesNotMatch(source, /site\/lighthouse|npm ci/);
});
