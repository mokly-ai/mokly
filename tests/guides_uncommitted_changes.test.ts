import assert from "node:assert/strict";
import test from "node:test";

import { UNCOMMITTED_CHANGES_LINE } from "../src/cli/publish_output.js";
import {
  uncommittedChangesChanged,
  uncommittedChangesUnavailable,
} from "../src/publish/errors.js";
import { validateUploadManifest } from "../src/publish/manifest.js";
import { UNCOMMITTED_CHANGES_STATUS } from "../src/publish/working_tree.js";

import { GUIDES } from "./helpers/guides.js";
import {
  exchange,
  prose,
  protocol,
  read,
  terminal,
} from "./helpers/guides_ci.js";

const flat = (value: string) => value.replace(/\s+/gu, " ");
const guide = (id: string) =>
  flat(GUIDES.find((page) => page.id === id)?.source ?? "");
const action = flat(read(".github/actions/publish/README.md"));

test("the upload contract pins the exact status arguments", () => {
  assert.ok(
    protocol.includes(`git ${UNCOMMITTED_CHANGES_STATUS.join(" ")}`),
    "mokly-upload.md must show the fixed Git status command",
  );
  for (const option of ["--untracked-files=all", "--ignore-submodules=none"])
    assert.ok(UNCOMMITTED_CHANGES_STATUS.includes(option), option);
});

test("the result line and Git failures share one copy across code and docs", () => {
  for (const [name, source] of [
    ["terminal", terminal],
    ["exchange", exchange],
    ["publish guide", guide("cli/publish")],
    ["CI guide", guide("ci/publish-from-ci")],
  ] as const)
    assert.ok(source.includes(UNCOMMITTED_CHANGES_LINE), name);
  for (const error of [
    uncommittedChangesChanged(),
    uncommittedChangesUnavailable(),
  ]) {
    assert.equal(error.code, "git-failed");
    assert.ok(protocol.includes(error.message), error.message);
    assert.ok(terminal.includes(error.message), error.message);
  }
  assert.ok(guide("cli/publish").includes(uncommittedChangesChanged().message));
});

test("the publication rule appears in the contract, exchange and guides", () => {
  for (const rule of [
    "A receiver keeps at most one clean publication for each `headSha` and `configPath`: the first clean publication that it completes.",
    "A publication with `uncommittedChanges: true` never claims that key and never replaces a clean publication.",
    "A later clean publication of a commit becomes the publication of that commit, also when dirty publications of it exist.",
  ])
    assert.ok(protocol.includes(rule), rule);
  assert.match(
    exchange,
    /A Plan or Complete joins an existing publication only when both have the same `uncommittedChanges` value/u,
  );
  assert.match(exchange, /Overlapping dirty uploads each receive `201`/u);
  assert.match(exchange, /`200` for a dirty upload as `upload-failed`/u);
  assert.match(prose, /first clean publication/u);
  assert.match(prose, /always creates its own publication/u);
  for (const source of [guide("ci/github-action"), action])
    assert.match(
      source,
      /untracked files which Git does not ignore.*uncommitted changes.*`\.gitignore`/u,
    );
});

test("the documented manifest fields are exactly what readers require", () => {
  const document = read("docs/protocol/mokly-upload.md");
  const block = /interface MoklyUploadV2 \{\n([\s\S]*?)\n\}/u.exec(document);
  assert.ok(block);
  const fields = [...(block[1] ?? "").matchAll(/^ {2}(\w+):/gmu)].map(
    ([, name]) => name ?? "",
  );
  assert.deepEqual(fields, [
    "schemaVersion",
    "moklyVersion",
    "repository",
    "branch",
    "headSha",
    "uncommittedChanges",
    "baseRef",
    "baseSha",
    "pullRequest",
    "configPath",
    "exportedAt",
    "comparisonPath",
  ]);
  const manifest = {
    schemaVersion: 2,
    moklyVersion: "1.0.0",
    repository: { host: "example.com", owner: "team", name: "project" },
    branch: "main",
    headSha: "a".repeat(40),
    uncommittedChanges: true,
    baseRef: null,
    baseSha: null,
    pullRequest: null,
    configPath: "mokly.config.ts",
    exportedAt: "2026-10-05T00:00:00.000Z",
    comparisonPath: null,
  };
  assert.deepEqual(Object.keys(manifest), fields);
  assert.deepEqual(validateUploadManifest(manifest), manifest);
  assert.throws(
    () => validateUploadManifest({ ...manifest, schemaVersion: 1 }),
    {
      code: "upload-unsupported-version",
    },
  );
});
