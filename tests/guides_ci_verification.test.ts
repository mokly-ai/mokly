import assert from "node:assert/strict";
import test from "node:test";

import {
  read,
  protocol,
  verification,
  workflow,
  release,
  sources,
} from "./helpers/guides_ci_context.js";

test("test repository inputs are deterministic and title types stay fixed", () => {
  assert.match(verification, /isolated fixture repository/u);
  assert.match(
    verification,
    /deterministic source edit.*asserts its exact changed destinations and count/u,
  );
  assert.match(
    verification,
    /browser suite's example server runs with `--base HEAD`/u,
  );
  assert.match(
    verification,
    /package, unit, browser, and hydration jobs key npm's download cache from the checked-out `package-lock\.json`/u,
  );
  assert.match(
    verification,
    /none resolves `origin\/main` or reads a branch-point lockfile/u,
  );
  assert.match(
    verification,
    /Unit and browser tests must depend only on the tree under test and fixture-owned state/u,
  );
  assert.match(
    verification,
    /Identical trees must produce identical test results.*release workflow's exact-tree evidence reuse depends/u,
  );
  for (const file of [
    "tests/preview.test.ts",
    "tests/deployment.test.ts",
    "tests/ci_workflow.test.ts",
  ])
    assert.ok(verification.includes(file), file);
  assert.match(
    verification,
    /tests\/ci_workflow\.test\.ts.*package, unit, browser, and hydration jobs.*checked-out lockfile.*never resolve `origin\/main` or a branch-point lockfile/u,
  );
  assert.match(
    verification,
    /Nothing scans test code for remote-branch reads.*New tests rely on review/u,
  );
  assert.match(
    verification,
    /No workflow or composite-action `run:` step may delete remote Git state/u,
  );
  assert.match(
    verification,
    /shared Git worktree.*deletes the shared repository's remotes, remote-tracking references or upstream settings/u,
  );
  assert.match(
    verification,
    /tests\/ci_workflow_remote_state\.test\.ts.*text check.*command scanner in.*tests\/helpers\/remote_state_commands\.ts.*cannot see commands inside scripts that a step calls/u,
  );
  assert.match(verification, /This type list is fixed/u);
  assert.match(verification, /asserts the list directly/u);
  assert.match(verification, /does not derive policy from Git history/u);
  assert.doesNotMatch(
    verification,
    /lockfile read from the merge-base commit/u,
  );
  assert.match(
    release,
    /CI verification contract.*dependency-cache-and-security.*owns cache inputs/u,
  );
  assert.match(release, /CI workflow graph contract.*owns checkout history/u);
  assert.match(
    workflow,
    /It must fetch release tags for the public-package-export ratchet, plus `origin\/main` and enough history for merge-base ratchets and the baseline dependency audit\. The baseline audit reads the root manifest, lockfile, and exception file from that comparison commit/u,
  );
  assert.match(
    workflow,
    /same-repository Preview deployment resolves `origin\/main` for its branch comparison and branch-point lockfile/u,
  );
  assert.match(
    workflow,
    /package, unit, browser, and hydration jobs keep complete history for fixture-owned historical baselines but never read remote-tracking references/u,
  );
  assert.match(
    workflow,
    /Every cached CI job keys npm's download cache from the checked-out `package-lock\.json`\. Only the repository audit reads a comparison-commit lockfile, for baseline evaluation rather than a cache key/u,
  );
  assert.match(
    verification,
    /The suites below own the report evidence that status validates/u,
  );
  for (const source of [verification, workflow]) {
    assert.doesNotMatch(source, /the only job that intentionally resolves/iu);
    assert.doesNotMatch(
      source,
      /include the merge-base lockfile in their cache key/iu,
    );
  }
  assert.doesNotMatch(
    release,
    /includes the merge-base lockfile in cache keys/u,
  );
  assert.doesNotMatch(
    release,
    /Full Git history is available where baseline resolution requires/u,
  );
});

test("browser shards stay whole and balanced by test count", () => {
  assert.match(
    verification,
    /\| Browser \|.*`fullyParallel: false`.*A shard runs its whole-file partition\. \|/u,
  );
  assert.match(
    verification,
    /requires browser shard file assignments to be pairwise disjoint; every browser spec therefore stays whole and no spec uses parallel mode/u,
  );
  assert.match(
    verification,
    /Specs whose filenames contain `hydration` run unsharded in the separate `hydration` project and CI job/u,
  );
  assert.match(
    verification,
    /tests\/browser_shard_balance\.test\.ts.*fails when any shard holds more than 125% of an even share of the browser tests.*runs the aggregate's `validateShardReports`/u,
  );
  assert.match(
    verification,
    /When the bound fails, split a large non-hydration spec into smaller spec files/u,
  );
  assert.match(
    verification,
    /all-project Playwright inventory, then the complete `chromium` inventory and each `chromium` shard.*each listing one at a time.*without an atomic rename.*concurrent listings on an empty cache/u,
  );
  assert.match(
    verification,
    /A failed browser discovery reports the load errors from Playwright's JSON output as well as its standard error/u,
  );
});

test("CI flags and credential sources exist in code and the upload contract", () => {
  const parser = read("src/cli/arguments.ts");
  const help = read("src/cli/help.ts");
  for (const [id, source] of sources) {
    for (const [, flags] of source.matchAll(
      /\bnpx (?:--no-install )?mokly publish([^\n]*)/gu,
    )) {
      for (const [flag] of (flags ?? "").matchAll(/--[a-z]+(?:-[a-z]+)*/gu)) {
        assert.ok(parser.includes(`"${flag}"`), `${id}: ${flag}`);
        assert.ok(
          help.includes(flag) && protocol.includes(flag),
          `${id}: ${flag}`,
        );
      }
    }
  }
  for (const name of ["MOKLY_ENDPOINT", "MOKLY_TOKEN"]) {
    assert.ok(sources.get("ci/publish-from-ci")?.includes(name));
    assert.ok(protocol.includes(name));
    assert.ok(read("src/publish/options.ts").includes(name));
  }
});
