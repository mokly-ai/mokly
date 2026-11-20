import assert from "node:assert/strict";
import { test } from "node:test";

import { elisionText } from "../fixtures/build-copy";
import { referenceHistory } from "../fixtures/build-history";
import { builds, shortSha } from "../fixtures/builds";
import { branches, publication, pullRequests } from "../fixtures/publications";

/**
 * The build fixtures the drawings read: each build's output, as the runner and
 * its tools print it, and each build's head, which every row, history entry
 * and publication that shows it repeats.
 */

test("the build output is the runner's argv and real tool output, with no credential", () => {
  for (const [name, build] of Object.entries(builds)) {
    assert.match(build.checkout.head, /^[0-9a-f]{40}$/, name);
    for (const entry of build.output) {
      if ("elided" in entry) continue;
      assert.doesNotMatch(
        entry.text,
        /mkb_|mkc_|ghs_|ghp_|x-access-token|MOKLY_TOKEN|\[redacted\]/,
        name,
      );
      if (entry.stream !== "system") continue;
      assert.match(
        entry.text,
        /^(\$ (git|npm ci|test -x|\/workspace\/repo\/node_modules\/\.bin\/mokly) |exit \d+$|stopped at the time limit$)/,
        name + ": " + entry.text,
      );
      assert.doesNotMatch(entry.text, /\bnpx\b/, name);
      if (entry.text.includes(" publish --config "))
        assert.ok(
          entry.text.endsWith(
            build.checkout.compared ? " --base origin/main" : " --no-changes",
          ),
          name,
        );
      if (entry.text.startsWith("$ git fetch "))
        assert.equal(
          entry.text.includes(" +refs/heads/main:refs/remotes/origin/main"),
          build.checkout.compared,
          name,
        );
    }
  }
  const elided = builds.published.output.filter((entry) => "elided" in entry);
  assert.equal(elided.length, 1);
  assert.equal(elisionText(1_412_866), "1.4 MB of output not kept");
  assert.equal(elisionText(48_200), "48.2 KB of output not kept");
});

test("a Bun lockfile ends the build at the lockfile search, before any install", () => {
  const build = builds.lockfile;
  const output = build.output.map((entry) =>
    "elided" in entry ? ["elided", ""] : [entry.stream, entry.text],
  );
  const search = output.findIndex(([, text]) =>
    text.startsWith("$ git ls-files -z -- "),
  );
  assert.ok(search > 0, "the checkout runs before the lockfile search");
  assert.ok(
    output
      .slice(0, search)
      .some(([, text]) =>
        text.startsWith(
          "$ git checkout --quiet --force -B " + build.reference.name + " ",
        ),
      ),
  );
  const candidates = output[search][1].split(" ");
  for (const lockfile of ["bun.lock", "bun.lockb", "package-lock.json"])
    assert.ok(candidates.includes(lockfile), lockfile);
  // The search prints the one lockfile it found and exits; no install runs.
  assert.deepEqual(output.slice(search + 1), [
    ["stdout", "bun.lock"],
    ["system", "exit 0"],
  ]);
  assert.deepEqual(
    [build.state, build.step, build.cause],
    ["failed", "install", "unsupported-lockfile"],
  );
});

test("a build's head is the same build wherever a row or a publication shows it", () => {
  const heads = Object.values(builds).map((build) => build.checkout.head);
  assert.equal(new Set(heads).size, heads.length);
  assert.equal(shortSha(builds.published), publication.sha);
  assert.equal(
    branches.find((branch) => branch.name === publication.branch)?.sha,
    shortSha(builds.running),
  );
  assert.equal(pullRequests[1].sha, shortSha(builds.pullRequest));
  // A row that takes its state from a build names that build's reference and
  // shows its head: the running builds, and the failed build whose Details
  // the switcher opens.
  const rows = [...branches, ...pullRequests];
  assert.deepEqual(
    rows.flatMap((row) => ("build" in row ? [row.build] : [])),
    ["running", "lockfile", "pullRequest"],
  );
  for (const row of rows) {
    if (!("build" in row)) continue;
    const build = builds[row.build];
    const reference = build.reference;
    assert.equal(row.sha, shortSha(build), row.name);
    assert.equal(
      row.name,
      reference.kind === "branch"
        ? reference.name
        : reference.number + " " + reference.title,
      row.name,
    );
  }
  assert.deepEqual(
    referenceHistory
      .filter((entry) => entry.kind === "build")
      .map((entry) => [entry.sha, entry.state]),
    [
      [shortSha(builds.running), "publishing"],
      [shortSha(builds.failed), "failed"],
    ],
  );
  assert.deepEqual(
    referenceHistory.map((entry) => entry.kind),
    [
      "build",
      "publication",
      "build",
      "publication",
      "publication",
      "publication",
    ],
  );
});
