import assert from "node:assert/strict";
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
import { textOutput } from "./helpers/generated_text.js";

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
      .stat(path.join(fixture.mockupsDir, MANIFEST_NAME))
      .catch(() => undefined),
    undefined,
  );
  await store.write(fixture.baseline, fixture.config);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "screens/home.mobile.html"),
    "locally edited output",
  );
  await store.check(await compileCatalogue(fixture.config), fixture.config);
  assert.equal(
    await fs.readFile(path.join(fixture.mockupsDir, "guide.html"), "utf8"),
    "<!doctype html><p>Guide</p>",
  );
});

test("derived check lists every tracked generated or cache path with ignore guidance", async (t) => {
  const fixture = await derivedFixture(t);
  const store = new FileSystemGeneratedOutputStore();
  await store.write(fixture.baseline, fixture.config);
  await fs.mkdir(path.join(fixture.root, ".mokly-cache"));
  await fs.writeFile(
    path.join(fixture.root, ".mokly-cache", "forced.txt"),
    "cache",
  );
  const tracked = [
    "mockups/screens/home.mobile.html",
    `mockups/${MANIFEST_NAME}`,
    ".mokly-cache/forced.txt",
  ];
  await fixture.git("add", "-f", "--", ...tracked);
  await assert.rejects(
    async () => store.check(fixture.baseline, fixture.config),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "build-invalid");
      for (const name of tracked) assert.ok(error.message.includes(name), name);
      assert.match(error.message, /\.gitignore/);
      assert.match(error.message, /git rm --cached/);
      return true;
    },
  );
});

test("derived check rejects retired generated routes from the index even when their local files are absent", async (t) => {
  const fixture = await derivedFixture(t);
  const store = new FileSystemGeneratedOutputStore();
  await store.write(fixture.baseline, fixture.config);
  const retired = "mockups/screens/retired.mobile.html";
  await fs.rename(
    path.join(fixture.root, "mockups/screens/home.mobile.html"),
    path.join(fixture.root, retired),
  );
  await fixture.git("add", "-f", "--", retired);
  await fs.rm(path.join(fixture.root, retired));
  await assert.rejects(
    async () => store.check(fixture.baseline, fixture.config),
    (error: Error & { code?: string }) => {
      assert.equal(error.code, "build-invalid");
      assert.ok(error.message.includes(retired));
      return true;
    },
  );
  await fixture.git("rm", "--cached", "--", retired);
  const guide = "mockups/guide.html";
  await fs.writeFile(
    path.join(fixture.root, guide),
    `<!doctype html>\n${textOutput(fixture.baseline.outputs, "screens/home.mobile.html")}`,
  );
  await fixture.git("add", "-f", "--", guide);
  await fs.rm(path.join(fixture.root, guide));
  await store.check(fixture.baseline, fixture.config);
});

test("indexed ownership checking accepts only Git's defined no-match status", async (t) => {
  const fixture = await derivedFixture(t);
  for (const exitCode of [1, 128]) {
    const tracking = new GitTrackedGeneratedOutput({
      async run(argv) {
        if (argv[0] === "rev-parse") return fixture.root;
        if (argv[0] === "ls-files") return "";
        throw new GitProcessError(exitCode, null, "index read failed");
      },
    });
    if (exitCode === 1) await tracking.check(fixture.baseline, fixture.config);
    else
      await assert.rejects(
        () => tracking.check(fixture.baseline, fixture.config),
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
    await fs.readFile(path.join(config.mockupsDir, MANIFEST_NAME), "utf8"),
    textOutput(compilation.outputs, MANIFEST_NAME),
  );
  const rename = fs.rename;
  let failed = false;
  t.mock.method(fs, "rename", async (from: string, to: string) => {
    if (!failed && from.includes(`${path.sep}stage${path.sep}`)) {
      failed = true;
      throw new Error("injected install failure");
    }
    return rename(from, to);
  });
  await assert.rejects(
    () => store.write(compilation, config),
    /injected install failure/,
  );
  for (const [route, bytes] of compilation.outputs)
    assert.equal(
      await fs.readFile(path.join(config.mockupsDir, route), "utf8"),
      bytes,
    );
});
