import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parseArguments } from "../dist/cli/arguments.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { startFakeReceiver } from "./helpers/fake_receiver.js";
import { repositoryRoot } from "./helpers/fixture.js";

const execute = promisify(execFile);
const cli = path.join(repositoryRoot, "dist/cli/bin.js");

test("publish accepts its options without making export an upload alias", () => {
  assert.deepEqual(
    parseArguments([
      "publish",
      "--endpoint",
      "https://example.com/uploads",
      "--token",
      "secret",
      "--config",
      "tools/config.ts",
      "--out",
      "site",
      "--base",
      "main",
      "--repository",
      "git.example.com/team/project",
      "--upload-concurrency",
      "4",
    ]),
    {
      command: "publish",
      help: false,
      version: false,
      endpoint: "https://example.com/uploads",
      token: "secret",
      config: "tools/config.ts",
      out: "site",
      base: "main",
      repository: "git.example.com/team/project",
      uploadConcurrency: 4,
    },
  );
  assert.equal(parseArguments(["publish", "--no-changes"]).noChanges, true);
  assert.throws(
    () => parseArguments(["publish", "--no-changes", "--base", "HEAD"]),
    /cli-invalid/,
  );
  for (const option of ["--endpoint", "--token", "--repository"])
    assert.throws(
      () => parseArguments(["export", "--out", "site", option, "value"]),
      /cli-invalid/,
    );
  assert.throws(
    () => parseArguments(["export", "--out", "site", "--no-changes"]),
    /cli-invalid/,
  );
  assert.throws(() => parseArguments(["publish", "--watch"]), /cli-invalid/);
  assert.equal(
    parseArguments(["publish", "--upload-concurrency=32"]).uploadConcurrency,
    32,
  );
  for (const value of ["", "0", "01", "1.5", "33", "-1", "four"])
    assert.throws(
      () => parseArguments(["publish", `--upload-concurrency=${value}`]),
      /cli-invalid.*upload-concurrency/,
      value,
    );
  assert.throws(
    () =>
      parseArguments(["export", "--out", "site", "--upload-concurrency", "4"]),
    /cli-invalid.*upload-concurrency.*publish/,
  );
});

test("publish help and credential preflight need no config", async () => {
  const { stdout } = await execute(
    process.execPath,
    [cli, "publish", "--help"],
    { cwd: "/tmp" },
  );
  assert.match(stdout, /MOKLY_ENDPOINT/);
  await assert.rejects(
    execute(process.execPath, [cli, "publish"], {
      cwd: "/tmp",
      env: { ...process.env, MOKLY_ENDPOINT: "", MOKLY_TOKEN: "" },
    }),
    (error: unknown) => {
      assert.match(
        (error as { stderr: string }).stderr,
        /\[mokly\/cli-invalid\].*endpoint/,
      );
      return true;
    },
  );
});

test("publish POSTs gzip using environment credentials and keeps a replaceable owned manifest", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await fixture.git(
    "remote",
    "add",
    "origin",
    "git@github.com:sample/catalogue.git",
  );
  const ahead = (
    await fixture.git(
      "commit-tree",
      "HEAD^{tree}",
      "-p",
      "HEAD",
      "-m",
      "test: advance base",
    )
  ).stdout.trim();
  await fixture.git("update-ref", "refs/remotes/origin/main", ahead);
  const receiver = await startFakeReceiver(context, {
    endpointPath: "/upload?scope=catalogue",
    token: "fixture-token",
  });
  const env = {
    ...process.env,
    MOKLY_ENDPOINT: receiver.endpoint,
    MOKLY_TOKEN: "fixture-token",
    GITHUB_ACTIONS: "true",
    GITHUB_HEAD_REF: "feature/screens",
    GITHUB_REF: "refs/pull/42/merge",
  };
  const args = [cli, "publish", "--out", "site"];
  const { stdout, stderr } = await execute(process.execPath, args, {
    cwd: fixture.root,
    env,
  });
  const firstMarker = JSON.parse(
    receiver.plans[0]!.files.get(".mokly-export-artifact")!.toString("utf8"),
  ) as { files: Array<{ sha256: string }> };
  const firstUploaded = firstMarker.files.filter(({ sha256 }) =>
    receiver.plans[0]!.missing.includes(sha256),
  ).length;
  assert.equal(
    stdout,
    `Published Mokly catalogue. ${firstUploaded} files uploaded, ${firstMarker.files.length - firstUploaded} unchanged.\n` +
      `${receiver.origin}/catalogues/publication-1/view\n`,
  );
  assert.doesNotMatch(stdout + stderr, /fixture-token/);
  assert.equal(receiver.plans.length, 1);
  assert.deepEqual(
    [...receiver.plans[0]!.files.keys()],
    [
      "mokly-upload.json",
      ".mokly-export-artifact",
      JSON.parse(
        await fs.promises.readFile(
          path.join(fixture.output, "mokly-upload.json"),
          "utf8",
        ),
      ).comparisonPath,
    ],
  );
  assert.ok(receiver.puts.length > 0);
  const manifestPath = path.join(fixture.output, "mokly-upload.json");
  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
  for (const archivedPath of ["mokly-upload.json", manifest.comparisonPath]) {
    const entry = receiver.plans[0]!.ownership.files.find(
      ({ path: name }) => name === archivedPath,
    );
    assert.ok(entry, archivedPath);
    assert.equal(receiver.plans[0]!.missing.includes(entry.sha256), false);
  }
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.branch, "feature/screens");
  assert.equal(manifest.pullRequest, 42);
  assert.equal(manifest.configPath, "mokly.config.ts");
  assert.deepEqual(manifest.repository, {
    host: "github.com",
    owner: "sample",
    name: "catalogue",
  });
  assert.equal(
    manifest.headSha,
    (await fixture.git("rev-parse", "HEAD")).stdout.trim(),
  );
  const review = JSON.parse(
    await fs.promises.readFile(
      path.join(fixture.output, manifest.comparisonPath),
      "utf8",
    ),
  );
  assert.equal(manifest.baseSha, review.baseCommit);
  assert.notEqual(
    manifest.baseSha,
    ahead,
    "baseSha is the merge base, not the base branch tip",
  );
  assert.equal(manifest.baseRef, review.baseRef);
  const putsAfterFirst = receiver.puts.length;
  const replay = await execute(process.execPath, args, {
    cwd: fixture.root,
    env,
  });
  assert.equal(
    replay.stdout,
    "Mokly catalogue already published for this commit.\n" +
      `${receiver.origin}/catalogues/publication-1/view\n`,
  );
  assert.deepEqual(receiver.plans[1]!.missing, []);
  assert.equal(receiver.puts.length, putsAfterFirst);
  const second = await execute(process.execPath, [...args, "--no-changes"], {
    cwd: fixture.root,
    env,
  });
  assert.equal(
    second.stdout,
    "Mokly catalogue already published for this commit.\n" +
      `${receiver.origin}/catalogues/publication-1/view\n`,
  );
  const current = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
  assert.equal(current.baseRef, null);
  assert.equal(current.baseSha, null);
  assert.equal(current.comparisonPath, null);
  assert.deepEqual(
    [...receiver.plans[2]!.files.keys()],
    ["mokly-upload.json", ".mokly-export-artifact"],
  );
  assert.equal(
    fs.existsSync(path.join(fixture.output, "__mokly/diffs")),
    false,
  );
  await execute(process.execPath, [cli, "export", "--out", "site"], {
    cwd: fixture.root,
    env,
  });
  assert.equal(
    receiver.plans.length,
    3,
    "export never uploads even with credentials in env",
  );
  assert.equal(fs.existsSync(manifestPath), false);
});

test("rejected uploads keep the export and redact secrets even in diagnostic errors", async (context) => {
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  const receiver = await startFakeReceiver(context, { token: "fixture-token" });
  for (const suffix of [[], ["--unexpected=fixture-token"]]) {
    receiver.queue("plan", { status: 401, body: "fixture-token" });
    await assert.rejects(
      execute(
        process.execPath,
        [
          cli,
          "publish",
          "--endpoint",
          receiver.endpoint,
          "--token",
          "fixture-token",
          "--repository",
          "github.com/sample/catalogue",
          "--no-changes",
          ...suffix,
        ],
        { cwd: fixture.root, env: { ...process.env, MOKLY_DIAGNOSTIC: "1" } },
      ),
      (error: unknown) => {
        const { stdout, stderr } = error as { stdout: string; stderr: string };
        assert.doesNotMatch(stdout + stderr, /fixture-token/);
        assert.match(
          stderr,
          suffix.length ? /cli-invalid/ : /upload-unauthorized/,
        );
        return true;
      },
    );
  }
  assert.ok(
    fs.existsSync(
      path.join(fixture.root, ".context/mokly-publish/mokly-upload.json"),
    ),
  );
});
