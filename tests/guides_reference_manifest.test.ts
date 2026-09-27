import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseReviewResult } from "@mokly/viewer/data";

import { exportCatalogue } from "../dist/export/run.js";
import { validateUploadManifest } from "../src/publish/manifest.js";
import { readUploadIdentity } from "../src/publish/metadata.js";
import type { GitCommandRunner } from "../src/review/git.js";

import { createExportFixture } from "./helpers/export_fixture.js";
import { codeCell, GUIDES, guideSection, tableRows } from "./helpers/guides.js";

const receiver =
  GUIDES.find((guide) => guide.id === "reference/upload-receiver")?.body ?? "";
const manifestSection = guideSection(receiver, "The upload manifest");
const flat = (text: string) => text.replace(/\s+/gu, " ");
const rows = new Map(
  tableRows(manifestSection).map(([field, type, value]) => [
    codeCell(field),
    { type: type ?? "", value: value ?? "" },
  ]),
);
const current = {
  schemaVersion: 1,
  moklyVersion: "1.2.3",
  repository: { host: "git.example.com", owner: "team/web", name: "shop" },
  branch: "feature/checkout",
  headSha: "a".repeat(40),
  baseRef: null,
  baseSha: null,
  pullRequest: null,
  configPath: "tools/mokly.config.ts",
  exportedAt: "2026-09-25T09:30:00.000Z",
  comparisonPath: null,
};
const compared = {
  ...current,
  headSha: "b".repeat(64),
  baseRef: "origin/main",
  baseSha: "c".repeat(64),
  pullRequest: 42,
  comparisonPath: `__mokly/diffs/__generations/${"d".repeat(64)}/review.json`,
};

function accepts(patch: Record<string, unknown>): boolean {
  try {
    validateUploadManifest({ ...compared, ...patch });
    return true;
  } catch {
    return false;
  }
}

function bound(text: string | undefined): number {
  const match = /(?:1 to|up to) ([\d,]+) bytes/u.exec(text ?? "")?.[1];
  assert.ok(match, `no byte bound in ${text}`);
  return Number(match.replaceAll(",", ""));
}

test("the manifest table lists exactly the validated fields and types", () => {
  assert.deepEqual([...rows.keys()], Object.keys(current));
  for (const sample of [current, compared])
    assert.deepEqual(validateUploadManifest(sample), sample);
  const kind = (value: unknown) => (value === null ? "null" : typeof value);
  for (const [name, { type }] of rows) {
    const field = name as keyof typeof current;
    assert.deepEqual(
      [...new Set([current[field], compared[field]].map(kind))].sort(),
      type.split(" or ").sort(),
      name,
    );
  }
  for (const name of Object.keys(current)) {
    const missing: Record<string, unknown> = { ...current };
    delete missing[name];
    assert.throws(() => validateUploadManifest(missing), {
      code: "upload-invalid-bundle",
    });
  }
  assert.throws(() => validateUploadManifest({ ...current, extra: true }), {
    code: "upload-invalid-bundle",
  });
  assert.throws(
    () => validateUploadManifest({ ...current, schemaVersion: 2 }),
    { code: "upload-unsupported-version" },
  );
  assert.ok(!accepts({ comparisonPath: null }));
  assert.ok(!accepts({ baseSha: null }));
  assert.ok(!accepts({ pullRequest: 0 }));
});

test("the documented byte bounds are the validated bounds", () => {
  for (const field of ["branch", "baseRef", "configPath"]) {
    const limit = bound(rows.get(field)?.value);
    const text = (size: number) =>
      field === "configPath" ? `${"c".repeat(size - 3)}.ts` : "b".repeat(size);
    assert.ok(accepts({ [field]: text(limit) }), field);
    assert.ok(!accepts({ [field]: text(limit + 1) }), field);
    assert.ok(!accepts({ [field]: "" }), field);
  }
  const version = (size: number) => `1.2.3+${"a".repeat(size - 6)}`;
  const versionLimit = bound(rows.get("moklyVersion")?.value);
  assert.ok(accepts({ moklyVersion: version(versionLimit) }));
  assert.ok(!accepts({ moklyVersion: version(versionLimit + 1) }));
  const prose = flat(manifestSection);
  const hostLimit = Number(
    /`repository\.host` is [^.]*? up to (\d+) bytes/u.exec(prose)?.[1],
  );
  const partLimit = Number(
    /each of the two is up to (\d+) bytes/u.exec(prose)?.[1],
  );
  const host = (size: number) => {
    const labels: string[] = [];
    for (let left = size; left > 0; left -= 64)
      labels.push("h".repeat(Math.min(63, left)));
    return labels.join(".");
  };
  assert.equal(host(hostLimit).length, hostLimit);
  const repository = (patch: Record<string, string>) => ({
    repository: { ...compared.repository, ...patch },
  });
  assert.ok(accepts(repository({ host: host(hostLimit) })));
  assert.ok(!accepts(repository({ host: host(hostLimit + 1) })));
  assert.ok(!accepts(repository({ host: "git.example.com:443" })));
  for (const part of ["owner", "name"]) {
    assert.ok(accepts(repository({ [part]: "o".repeat(partLimit) })), part);
    assert.ok(
      !accepts(repository({ [part]: "o".repeat(partLimit + 1) })),
      part,
    );
    assert.ok(!accepts(repository({ [part]: ".." })), part);
  }
  assert.ok(accepts(repository({ owner: "group/subgroup" })));
  assert.ok(!accepts(repository({ name: "group/subgroup" })));
});

test("documented text formats are the validated formats", () => {
  const configPath = rows.get("configPath")?.value ?? "";
  for (const rule of ["leading `/`", "backslash", "colon", "control character"])
    assert.ok(configPath.includes(rule), rule);
  assert.match(configPath, /empty, `\.` or `\.\.` segment/u);
  assert.ok(accepts({ configPath: "mokly.config.ts" }));
  for (const invalid of [
    "/tools/mokly.config.ts",
    "tools\\mokly.config.ts",
    "C:/tools/mokly.config.ts",
    "tools/\u0007.ts",
    "tools//mokly.config.ts",
    "./mokly.config.ts",
    "tools/../mokly.config.ts",
  ])
    assert.ok(!accepts({ configPath: invalid }), JSON.stringify(invalid));
  for (const field of ["branch", "baseRef"]) {
    assert.match(rows.get(field)?.value ?? "", /no control characters/u);
    assert.ok(!accepts({ [field]: "main\u0000" }), field);
    assert.ok(!accepts({ [field]: "main\n" }), field);
  }
  assert.match(
    rows.get("comparisonPath")?.value ?? "",
    /<64 lowercase hex characters>/u,
  );
  assert.ok(
    !accepts({
      comparisonPath: `__mokly/diffs/__generations/${"D".repeat(64)}/review.json`,
    }),
  );
});

test("branch and pull request follow the documented CI rules", async () => {
  const runner = (branch?: string): GitCommandRunner => ({
    run: async (args) => {
      switch (args.join(" ")) {
        case "rev-parse --show-toplevel":
          return "/repo\n";
        case "rev-parse --verify HEAD":
          return `${"a".repeat(40)}\n`;
        case "symbolic-ref --quiet --short HEAD":
          if (!branch) throw new Error("detached");
          return `${branch}\n`;
        default:
          throw new Error(`unexpected ${args.join(" ")}`);
      }
    },
  });
  const identity = (branch: string | undefined, env: Record<string, string>) =>
    readUploadIdentity(runner(branch), env, "github.com/team/shop");
  const actions = { GITHUB_ACTIONS: "true" };
  for (const [branch, env, expected, pullRequest] of [
    [undefined, {}, "HEAD", null],
    ["work", {}, "work", null],
    ["work", { GITHUB_HEAD_REF: "feature" }, "work", null],
    [
      undefined,
      {
        ...actions,
        GITHUB_HEAD_REF: "feature",
        GITHUB_REF: "refs/pull/7/merge",
      },
      "feature",
      7,
    ],
    [
      undefined,
      { ...actions, GITHUB_REF_TYPE: "branch", GITHUB_REF_NAME: "main" },
      "main",
      null,
    ],
    [undefined, { ...actions, GITHUB_REF: "refs/pull/8/head" }, "HEAD", 8],
    [
      "work",
      { ...actions, GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: "v1" },
      "work",
      null,
    ],
  ] as const) {
    const result = await identity(branch, env);
    assert.equal(result.branch, expected, JSON.stringify(env));
    assert.equal(result.pullRequest, pullRequest, JSON.stringify(env));
  }
  const prose = flat(manifestSection);
  for (const name of [
    "`GITHUB_ACTIONS=true`",
    "`GITHUB_HEAD_REF`",
    "`GITHUB_REF_NAME`",
    "`GITHUB_REF_TYPE`",
    "`refs/pull/<number>/merge`",
    "`refs/pull/<number>/head`",
  ])
    assert.ok(prose.includes(name), name);
  assert.match(prose, /`HEAD` when detached/u);
});

test("the named comparison validates with the documented public parser", async (context) => {
  const prose = flat(manifestSection);
  assert.match(prose, /`parseReviewResult` from `@mokly\/viewer\/data`/u);
  const versions = /accepts comparison `schemaVersion` `(\d+)` and `(\d+)`/u
    .exec(prose)
    ?.slice(1)
    .map(Number);
  assert.deepEqual(versions, [2, 3]);
  const unsupported = /unsupported result version/u;
  for (const schemaVersion of [1, 4])
    assert.throws(() => parseReviewResult({ schemaVersion }), unsupported);
  for (const schemaVersion of versions ?? [])
    assert.throws(
      () => parseReviewResult({ schemaVersion }),
      (error: Error) => !unsupported.test(error.message),
    );
  const fixture = await createExportFixture();
  context.after(() => fixture.close());
  await exportCatalogue(fixture.config, { outDir: "site" });
  const generations = path.join(fixture.output, "__mokly/diffs/__generations");
  const [generation] = readdirSync(generations);
  const review: unknown = JSON.parse(
    readFileSync(
      path.join(generations, generation ?? "", "review.json"),
      "utf8",
    ),
  );
  const parsed = parseReviewResult(review);
  assert.equal(typeof parsed.baseRef, "string");
  assert.match(parsed.baseCommit, /^[a-f0-9]{40}$/u);
});

test("duplicate-key checks cover only Mokly's own JSON files", () => {
  const validation = flat(guideSection(receiver, "Validating an upload"));
  assert.match(
    validation,
    /`mokly-upload\.json` or `\.mokly-export-artifact` has a duplicate JSON key/u,
  );
  assert.match(
    validation,
    /Do not reject an upload because another `\.json` file has duplicate JSON keys/u,
  );
});
