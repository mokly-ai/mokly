import assert from "node:assert/strict";
import test from "node:test";

import { runDependencyAuditPr } from "../scripts/verification/dependency-audit-pr.mjs";

import { prFinding, prHarness } from "./helpers/dependency_audit_pr.js";

function assertNoCalls(h: ReturnType<typeof prHarness>) {
  assert.deepEqual(h.commands, []);
  assert.deepEqual(h.requests, []);
  assert.match(h.output.errors.join("\n"), /[Ff]ix|[Rr]estore|[Rr]etry/u);
}

for (const args of [
  [],
  ["--help"],
  ["--outcome"],
  ["--outcome", "skipped", "--log", "audit.log", "--report", "report.json"],
  ["--outcome", "failure", "--log", "--report", "report.json"],
  ["--outcome", "failure", "--log", "audit.log"],
  [
    "--outcome",
    "failure",
    "--log",
    "audit.log",
    "--report",
    "report.json",
    "--log",
    "another.log",
  ],
]) {
  test(`invalid arguments fail before any calls: ${args.join(" ")}`, async () => {
    const h = prHarness();
    h.dependencies.args = args;
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assertNoCalls(h);
    assert.deepEqual(h.events, []);
  });
}

for (const name of [
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
  "GITHUB_SERVER_URL",
  "GITHUB_RUN_ID",
]) {
  for (const value of [undefined, "", "   "]) {
    test(`missing ${name} fails before any calls: ${String(value)}`, async () => {
      const h = prHarness();
      h.dependencies.env = { ...h.dependencies.env, [name]: value };
      assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
      assertNoCalls(h);
      assert.match(h.output.errors.join("\n"), new RegExp(name, "u"));
    });
  }
}

for (const [name, value] of [
  ["GITHUB_TOKEN", "token with whitespace"],
  ["GITHUB_REPOSITORY", "owner"],
  ["GITHUB_REPOSITORY", "owner/repo/extra"],
  ["GITHUB_REPOSITORY", "../repo"],
  ["GITHUB_REPOSITORY", "owner/.."],
  ["GITHUB_REPOSITORY", "./repo"],
  ["GITHUB_REPOSITORY", "owner/."],
  ["GITHUB_RUN_ID", "123;invalid"],
  ["GITHUB_SERVER_URL", "github.com"],
  ["GITHUB_SERVER_URL", "file:///tmp/server"],
  ["GITHUB_API_URL", "https://token@github.com"],
  ["GITHUB_API_URL", "https://api.github.com?token=abc"],
]) {
  test(`invalid environment ${name} fails before any calls`, async () => {
    const h = prHarness();
    h.dependencies.env = { ...h.dependencies.env, [name!]: value };
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assertNoCalls(h);
  });
}

const invalidReports: unknown[] = [
  null,
  [],
  {},
  { mode: "strict", ok: false, issues: [] },
  { mode: "strict", ok: true, issues: [prFinding] },
  { mode: "baseline", ok: false, issues: [prFinding] },
  { mode: "strict", ok: "false", issues: [prFinding] },
  { mode: "strict", ok: false, issues: {} },
  { mode: "strict", ok: false, issues: [null] },
  {
    mode: "strict",
    ok: false,
    issues: [{ kind: "other", message: "invalid" }],
  },
  { mode: "strict", ok: false, issues: [{ kind: "exception", message: "" }] },
  { mode: "strict", ok: false, issues: [{ ...prFinding, inherited: false }] },
  { mode: "strict", ok: false, issues: [prFinding], comparisonCommit: "base" },
  ...Object.keys(prFinding).map((key) => ({
    mode: "strict",
    ok: false,
    issues: [{ ...prFinding, [key]: key === "advisoryId" ? 123 : undefined }],
  })),
  ...[
    { package: "--ignore-scripts" },
    { advisoryUrl: "invalid" },
    { advisoryId: "not-a-GHSA" },
    { advisoryId: [prFinding.advisoryId] },
    { severity: "unknown" },
    { installLocations: [] },
    { installLocations: ["not-an-install-path"] },
    { title: "   " },
  ].map((fields) => ({
    mode: "strict",
    ok: false,
    issues: [{ ...prFinding, ...fields }],
  })),
];

for (const [index, report] of invalidReports.entries()) {
  test(`invalid report ${index} fails before any calls`, async () => {
    const h = prHarness();
    h.files.set("report.json", JSON.stringify(report));
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assertNoCalls(h);
  });
}

for (const success of [false, true]) {
  test(`mismatched outcome fails before any calls (reported success: ${success})`, async () => {
    const h = prHarness(success);
    h.dependencies.args = [
      "--outcome",
      success ? "failure" : "success",
      "--log",
      "audit.log",
      "--report",
      "report.json",
    ];
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assertNoCalls(h);
    assert.match(h.output.errors.join("\n"), /outcome disagrees/u);
  });
}

for (const kind of ["report", "input"]) {
  test(`${kind} issues make no calls even alongside valid findings`, async () => {
    const h = prHarness();
    h.files.set(
      "report.json",
      JSON.stringify({
        mode: "strict",
        ok: false,
        issues: [prFinding, { kind, message: "Registry or input failed." }],
      }),
    );
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assertNoCalls(h);
    assert.match(h.output.errors.join("\n"), /Registry or input failed/u);
  });
}

for (const file of ["report.json", "audit.log"]) {
  test(`missing ${file} makes no calls`, async () => {
    const h = prHarness();
    h.files.delete(file);
    assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
    assertNoCalls(h);
    assert.ok(h.output.errors.join("\n").includes(file));
  });
}

test("non-JSON and non-text artifacts make no calls", async () => {
  const h = prHarness();
  h.files.set("report.json", "not JSON");
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assertNoCalls(h);
  h.files.set(
    "report.json",
    JSON.stringify({ mode: "strict", ok: false, issues: [prFinding] }),
  );
  h.dependencies.readFile = async (file) =>
    file === "audit.log" ? (null as unknown as string) : h.files.get(file)!;
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assertNoCalls(h);
});

test("an invalid clock makes no calls", async () => {
  const h = prHarness();
  h.dependencies.clock = () => new Date("invalid");
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assertNoCalls(h);
});

test("a failed injected input boundary keeps a recovery action", async () => {
  const h = prHarness();
  h.dependencies.clock = () => {
    throw new Error("Clock unavailable");
  };
  assert.equal((await runDependencyAuditPr(h.dependencies)).ok, false);
  assertNoCalls(h);
  assert.match(h.output.errors.join("\n"), /Clock unavailable/u);
});
