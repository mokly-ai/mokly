import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { MoklyError } from "../dist/errors.js";
import { publishCatalogue } from "../dist/publish/run.js";
import { NodeGitCommandRunner } from "../dist/review/git.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import {
  config,
  dependencies,
  options,
} from "./helpers/publish_run_fixture.js";

test("publish refuses each Git change before export or a receiver request", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const original = (await fixture.git("rev-parse", "HEAD")).stdout.trim();
  const notes = path.join(fixture.root, "notes.md");
  const changes = [
    ["modified", async () => fs.writeFile(notes, "Changed\n"), "notes.md"],
    [
      "staged",
      async () => {
        await fs.writeFile(notes, "Staged\n");
        await fixture.git("add", "notes.md");
      },
      "notes.md",
    ],
    ["deleted", async () => fs.unlink(notes), "notes.md"],
    [
      "renamed",
      async () => fixture.git("mv", "notes.md", "renamed.md"),
      "renamed.md",
    ],
    [
      "type changed",
      async () => {
        await fs.unlink(notes);
        await fs.symlink("mokly.config.ts", notes);
      },
      "notes.md",
    ],
    [
      "untracked",
      async () => fs.writeFile(path.join(fixture.root, "new.md"), "New\n"),
      "new.md",
    ],
    [
      "unusual name",
      async () =>
        fs.writeFile(path.join(fixture.root, 'a "quote"\nname.md'), "New\n"),
      'a "quote"\\u000aname.md',
    ],
    [
      "authored temporary prefix",
      async () =>
        fs.writeFile(
          path.join(fixture.root, ".mokly-review-notes.md"),
          "New\n",
        ),
      ".mokly-review-notes.md",
    ],
    [
      "authored file in a temporary-looking directory",
      async () => {
        const directory = path.join(fixture.root, "mokly-config-author");
        await fs.mkdir(directory);
        await fs.writeFile(
          path.join(directory, "source.ts"),
          "export const value = 1;\n",
        );
      },
      "mokly-config-author/source.ts",
    ],
    [
      "tracked module in a temporary-looking directory",
      async () => {
        const directory = path.join(fixture.root, "mokly-config-author");
        await fs.mkdir(directory);
        await fs.writeFile(
          path.join(directory, "config.mjs"),
          "export default {};\n",
        );
        await fixture.git("add", "mokly-config-author");
        await fixture.git(
          "commit",
          "-qm",
          "test: authored module with temporary name",
        );
        await fs.writeFile(
          path.join(directory, "config.mjs"),
          "export default { changed: true };\n",
        );
      },
      "mokly-config-author/config.mjs",
    ],
    [
      "hidden untracked",
      async () => {
        await fixture.git("config", "status.showUntrackedFiles", "no");
        await fs.writeFile(path.join(fixture.root, "hidden.md"), "New\n");
      },
      "hidden.md",
    ],
    [
      "unmerged",
      async () => {
        await fixture.git("checkout", "-qb", "conflict");
        await fs.writeFile(notes, "Branch\n");
        await fixture.git("commit", "-am", "test: conflict branch");
        await fixture.git("checkout", "--detach", original);
        await fs.writeFile(notes, "Head\n");
        await fixture.git("commit", "-am", "test: conflict head");
        await assert.rejects(fixture.git("merge", "conflict"));
      },
      "notes.md",
    ],
  ] as const;
  for (const [name, change, expected] of changes) {
    await context.test(name, async () => {
      await change();
      const runtime = dependencies().boundaries;
      runtime.git = new NodeGitCommandRunner(fixture.root);
      let exports = 0;
      let requests = 0;
      runtime.export = async () => {
        exports++;
        assert.fail("export must not start");
      };
      runtime.fetch = async () => {
        requests++;
        assert.fail("receiver must not be contacted");
      };
      await assert.rejects(
        publishCatalogue(
          fixture.config,
          { ...options, out: "site" },
          "1.2.3",
          {},
          runtime,
        ),
        (error: unknown) => {
          assert.ok(error instanceof MoklyError);
          assert.equal(error.code, "git-uncommitted");
          assert.ok(error.detail.includes(expected), error.detail);
          return true;
        },
      );
      assert.equal(exports, 0);
      assert.equal(requests, 0);
    });
    await fixture.git("reset", "--hard", original);
    await fixture.git("clean", "-fd");
  }
});

test("publish refuses submodule changes even when user settings hide them", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const module = path.join(fixture.root, "dependency");
  await fs.mkdir(module);
  await fixture.git("-C", module, "init", "-q");
  await fixture.git(
    "-C",
    module,
    "config",
    "user.email",
    "test@example.invalid",
  );
  await fixture.git("-C", module, "config", "user.name", "Test");
  await fs.writeFile(path.join(module, "module.txt"), "Initial\n");
  await fixture.git("-C", module, "add", ".");
  await fixture.git("-C", module, "commit", "-qm", "test: module");
  await fixture.git(
    "-c",
    "protocol.file.allow=always",
    "submodule",
    "add",
    "./dependency",
    "dependency",
  );
  await fixture.git("commit", "-am", "test: add module");
  await fixture.git("config", "diff.ignoreSubmodules", "all");
  await fixture.git("config", "submodule.dependency.ignore", "all");
  await fs.writeFile(path.join(module, "module.txt"), "Changed\n");
  const runtime = dependencies().boundaries;
  runtime.git = new NodeGitCommandRunner(fixture.root);
  runtime.export = async () => assert.fail("export must not start");
  runtime.fetch = async () => assert.fail("receiver must not be contacted");
  await assert.rejects(
    publishCatalogue(
      fixture.config,
      { ...options, out: "site" },
      "1.2.3",
      {},
      runtime,
    ),
    (error: unknown) => {
      assert.ok(error instanceof MoklyError);
      assert.equal(error.code, "git-uncommitted");
      assert.match(error.detail, /dependency/);
      return true;
    },
  );
});

test("publish reads whole-repository machine status twice with fixed settings", async () => {
  const fixture = dependencies();
  const runtime = fixture.boundaries;
  const calls: string[][] = [];
  const events: string[] = [];
  const git = runtime.git;
  runtime.git = {
    run: async (args) => {
      calls.push([...args]);
      events.push(args[0]!);
      return git.run(args);
    },
  };
  const exportCatalogue = runtime.export;
  runtime.export = async (...args) => {
    events.push("export");
    return exportCatalogue(...args);
  };
  const fetch = runtime.fetch;
  runtime.fetch = async (...args) => {
    events.push("request");
    return fetch(...args);
  };
  await publishCatalogue(config, options, "1.2.3", {}, runtime);
  const status = [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignore-submodules=none",
    "--renames",
  ];
  assert.deepEqual(
    calls.filter((args) => args[0] === "status"),
    [status, status],
  );
  assert.ok(events.indexOf("status") < events.indexOf("export"));
  assert.ok(events.lastIndexOf("status") > events.indexOf("export"));
  assert.ok(events.lastIndexOf("status") < events.indexOf("request"));
});

test("files only in this run's unignored output directory do not block publish", async (context) => {
  const repository = await createExportFixture();
  context.after(() => repository.close());
  await fs.mkdir(repository.output);
  await fs.writeFile(
    path.join(repository.output, "only-output.txt"),
    "Local output\n",
  );
  const fixture = dependencies();
  fixture.boundaries.git = new NodeGitCommandRunner(repository.root);
  await publishCatalogue(
    repository.config,
    { ...options, out: "site" },
    "1.2.3",
    {},
    fixture.boundaries,
  );
  assert.equal(fixture.uploaded(), true);
});
