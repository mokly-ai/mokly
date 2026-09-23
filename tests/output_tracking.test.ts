import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { compileCatalogue } from "../dist/build/compile.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  removeFixture,
  repositoryRoot,
} from "./helpers/fixture.js";

const execute = promisify(execFile);

test("Check ignores local output without Git and validates tracked bytes from the index", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-tracking-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(fixture.root, root, { recursive: true });
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(root, "node_modules"),
  );
  const config = await loadConfig(root);
  const compilation = await compileCatalogue(config);
  const store = new FileSystemGeneratedOutputStore();
  assert.equal(await store.check(compilation, config), "untracked");
  await execute("git", ["init", "-q"], { cwd: root });
  await store.write(compilation, config);
  assert.equal(await store.check(compilation, config), "untracked");
  await execute("git", ["add", "mockups"], { cwd: root });
  assert.equal(await store.check(compilation, config), "tracked");
  await fs.writeFile(path.join(root, "mockups/mokly-manifest.json"), "stale");
  await assert.rejects(() => store.check(compilation, config), {
    code: "build-invalid",
  });
});

test("Build writes a new route in a tracked repository before staging it", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const git = (...args: string[]) =>
    execute("git", args, { cwd: fixture.root });
  await git("init", "-q");
  await git("config", "user.name", "Mokly Test");
  await git("config", "user.email", "test@example.invalid");
  const build = () =>
    execute(
      "node",
      [
        path.join(repositoryRoot, "dist/cli/bin.js"),
        "build",
        "--config",
        fixture.configPath,
      ],
      { cwd: fixture.root },
    );
  await build();
  await git("add", ".");
  await git("commit", "-qm", "test: baseline");
  await fs.appendFile(
    fixture.entryPath,
    '\nimport { definePage } from "@mokly/mokly";\nmockups.push(definePage({ id: "new-page", route: "new-page.html", title: "New Page", description: "New Page", dependencies: [], relatedDocs: [], render: () => "<!doctype html><html><head><title>New Page</title></head><body><main>New Page</main></body></html>" }));\n',
  );
  await build();
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await assert.rejects(
    () => new FileSystemGeneratedOutputStore().check(compilation, config),
    (error: unknown) => {
      assert.match(String(error), /generated output is partly tracked by Git:/);
      assert.match(String(error), /untracked:\n {2}- mockups\/new-page\.html/);
      return true;
    },
  );
});
