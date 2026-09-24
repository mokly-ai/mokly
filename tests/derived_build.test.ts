import assert from "node:assert/strict";
import fileSystem from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { GitTrackedGeneratedOutput } from "../dist/build/tracked_output.js";
import { loadConfig } from "../dist/config/load.js";
import { MANIFEST_NAME } from "../dist/registry/manifest.js";
import { GitProcessError } from "../dist/review/git_process.js";

import { derivedFixture } from "./helpers/derived_fixture.js";

test("derived check accepts missing or stale local output and tracked authored public files", async (t) => {
  const fixture = await derivedFixture(t, undefined, {
    "theme.css": "body {}",
    "guide.html": "<!doctype html><p>Guide</p>",
  });
  await fixture.git("add", "-f", "mockups/guide.html");
  const store = new FileSystemGeneratedOutputStore();
  await store.check(fixture.baseline, fixture.config);
  assert.equal(
    await fs
      .stat(path.join(fixture.config.generatedDir, MANIFEST_NAME))
      .catch(() => undefined),
    undefined,
  );
  await store.write(fixture.baseline, fixture.config);
  await fs.writeFile(
    path.join(fixture.config.generatedDir, "screens/home.mobile.html"),
    "locally edited output",
  );
  await store.check(await compileCatalogue(fixture.config), fixture.config);
  assert.equal(
    await fs.readFile(path.join(fixture.mockupsDir, "guide.html"), "utf8"),
    "<!doctype html><p>Guide</p>",
  );
});

test("check guards indexed cache paths and reports mixed generated paths", async (t) => {
  const fixture = await derivedFixture(t);
  const store = new FileSystemGeneratedOutputStore();
  await store.write(fixture.baseline, fixture.config);
  await fs.mkdir(path.join(fixture.root, ".mokly-cache"));
  await fs.writeFile(
    path.join(fixture.root, ".mokly-cache", "forced.txt"),
    "cache",
  );
  const tracked = [
    "mockups/.generated/screens/home.mobile.html",
    `mockups/.generated/${MANIFEST_NAME}`,
    ".mokly-cache/forced.txt",
  ];
  await fixture.git("add", "-f", "--", ...tracked);
  await assert.rejects(
    async () => store.check(fixture.baseline, fixture.config),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "build-invalid");
      assert.ok(error.message.includes(".mokly-cache/forced.txt"));
      assert.match(error.message, /\.gitignore/);
      assert.match(error.message, /git rm --cached/);
      return true;
    },
  );
  await fixture.git("rm", "--cached", "--", ".mokly-cache/forced.txt");
  await assert.rejects(
    () => store.check(fixture.baseline, fixture.config),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "build-invalid");
      for (const name of tracked.slice(0, 2))
        assert.ok(error.message.includes(name), name);
      assert.match(error.message, /untracked:/);
      return true;
    },
  );
});

test("check rejects indexed stray output but ignores indexed authored files", async (t) => {
  const fixture = await derivedFixture(t);
  const store = new FileSystemGeneratedOutputStore();
  await store.write(fixture.baseline, fixture.config);
  const retired = "mockups/.generated/screens/retired.mobile.html";
  await fs.rename(
    path.join(fixture.config.generatedDir, "screens/home.mobile.html"),
    path.join(fixture.root, retired),
  );
  await fixture.git("add", "-f", "--", retired);
  await fs.rm(path.join(fixture.root, retired));
  await assert.rejects(
    () => store.check(fixture.baseline, fixture.config),
    /generated output is partly tracked by Git:[\s\S]*retired.mobile.html/,
  );
  await fixture.git("rm", "--cached", "--", retired);
  const guide = "mockups/guide.html";
  await fs.writeFile(
    path.join(fixture.root, guide),
    `<!doctype html>\n${fixture.baseline.outputs.get("screens/home.mobile.html")}`,
  );
  await fixture.git("add", "-f", "--", guide);
  await fs.rm(path.join(fixture.root, guide));
  await store.check(fixture.baseline, fixture.config);
});

test("index read failures never masquerade as absent tracking", async (t) => {
  const fixture = await derivedFixture(t);
  for (const exitCode of [1, 128]) {
    const tracking = new GitTrackedGeneratedOutput({
      async run(argv) {
        if (argv[0] === "rev-parse") return fixture.root;
        if (argv[0] === "ls-files")
          throw new GitProcessError(exitCode, null, "index read failed");
        throw new Error(`unexpected Git command: ${argv[0]}`);
      },
    });
    await assert.rejects(
      () => tracking.state(fixture.baseline, fixture.config),
      { code: "build-invalid" },
    );
  }
});

test("derived build creates an absent nested directory transactionally and preserves prior output on failure", async (t) => {
  const fixture = await derivedFixture(t);
  await fs.writeFile(
    fixture.configPath,
    (await fs.readFile(fixture.configPath, "utf8")).replace(
      'mockupsDir: "mockups"',
      'mockupsDir: "new/deep/output"',
    ),
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const store = new FileSystemGeneratedOutputStore();
  await store.check(compilation, config);
  await store.write(compilation, config);
  assert.equal(
    await fs.readFile(path.join(config.generatedDir, MANIFEST_NAME), "utf8"),
    compilation.outputs.get(MANIFEST_NAME),
  );
  const rename = fileSystem.promises.rename.bind(fileSystem.promises);
  let failed = false;
  t.mock.method(
    fileSystem.promises,
    "rename",
    async (from: string, to: string) => {
      if (
        !failed &&
        from.endsWith(`${path.sep}stage`) &&
        to === config.generatedDir
      ) {
        failed = true;
        throw new Error("injected install failure");
      }
      return rename(from, to);
    },
  );
  await assert.rejects(
    () => store.write(compilation, config),
    /injected install failure/,
  );
  assert.equal(failed, true);
  for (const [route, bytes] of compilation.outputs)
    assert.equal(
      await fs.readFile(path.join(config.generatedDir, route), "utf8"),
      bytes,
    );
});
