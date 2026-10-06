import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { runDependencyAudit } from "../scripts/verification/dependency-audit.mjs";

import {
  auditHarness,
  changeManifest,
} from "./helpers/dependency_audit_runner.js";

test("baseline mode is lazy on a strictly clean head", async () => {
  const h = auditHarness();
  h.dependencies.args = ["--baseline"];
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "baseline");
  assert.equal(h.commands.length, 1);
  assert.equal(h.events.includes("resolve-base"), false);
  assert.equal(h.state.temporary, 0);
});

test("byte-identical inputs inherit findings with one registry call", async () => {
  const h = auditHarness(true);
  h.dependencies.args = ["--baseline"];
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "baseline");
  if (result.mode !== "baseline") return;
  assert.equal(result.comparisonCommit, "base");
  assert.ok(result.issues.every((issue) => issue.inherited));
  assert.equal(h.commands.length, 1);
  assert.equal(h.state.temporary, 0);
  assert.deepEqual(h.output.errors, []);
  assert.match(
    h.output.notices.join("\n"),
    /main.*dependency update pull request/u,
  );
  assert.match(h.output.notices.at(-1)!, /base.*1 inherited/u);
});

test("a harmless manifest edit audits baseline bytes in the temporary directory", async () => {
  const h = auditHarness(true);
  h.dependencies.args = ["--baseline"];
  changeManifest(h.files);
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, true);
  assert.deepEqual(
    h.commands.map((command) => command.cwd),
    ["/repo", "/tmp/audit-fixture"],
  );
  assert.ok(
    h.commands.every((command) => command.args.includes("--package-lock-only")),
  );
  assert.ok(h.events.indexOf("head-audit") < h.events.indexOf("base-audit"));
  for (const file of ["package.json", "package-lock.json"])
    assert.ok(h.written.get(file)!.equals(h.baseFiles.get(file)!));
  assert.equal(h.state.clocks, 1);
  assert.equal(h.state.disposed, 1);
});

test("dirty lockfile at comparison HEAD runs the baseline and fails a new finding", async () => {
  const h = auditHarness(true);
  h.dependencies.args = ["--baseline"];
  h.state.commit = "HEAD";
  h.files.set(
    "package-lock.json",
    Buffer.from(JSON.stringify(h.lockfile, null, 2)),
  );
  h.base.stdout = JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {},
  });
  h.base.exitCode = 0;
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, false);
  assert.equal(h.commands.length, 2);
  assert.equal(h.state.disposed, 1);
  assert.match(h.output.errors.join("\n"), /Uncovered advisory/u);
});

test("raw bytes that decode to the same text cannot skip the second audit", async () => {
  const h = auditHarness(true);
  h.dependencies.args = ["--baseline"];
  h.files.set("package.json", Buffer.from([0x80]));
  h.baseFiles.set("package.json", Buffer.from([0x81]));
  assert.equal(
    h.files.get("package.json")!.toString(),
    h.baseFiles.get("package.json")!.toString(),
  );
  await runDependencyAudit(h.dependencies);
  assert.equal(h.commands.length, 2);
});

test("another advisory and an added vulnerable install location fail inheritance", async () => {
  for (const change of ["advisory", "location"]) {
    const h = auditHarness(true);
    h.dependencies.args = ["--baseline"];
    changeManifest(h.files);
    const entry = h.report.vulnerabilities.braces!;
    if (change === "location")
      entry.nodes.push("node_modules/other/node_modules/braces");
    else
      for (const via of entry.via)
        if (typeof via !== "string")
          via.url = "https://github.com/advisories/GHSA-aaaa-bbbb-cccc";
    h.head.stdout = JSON.stringify(h.report);
    assert.equal((await runDependencyAudit(h.dependencies)).ok, false);
    assert.equal(h.state.disposed, 1);
  }
});

test("inherited expired and stale records pass using the same clock", async () => {
  for (const kind of ["expired", "stale"]) {
    const h = auditHarness();
    h.dependencies.args = ["--baseline"];
    changeManifest(h.files);
    if (kind === "expired") h.dependencies.clock = () => new Date("2026-11-04");
    else {
      h.head.stdout = h.base.stdout = JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {},
      });
      h.head.exitCode = h.base.exitCode = 0;
    }
    assert.equal((await runDependencyAudit(h.dependencies)).ok, true);
    assert.equal(h.state.disposed, 1);
    assert.match(
      h.output.notices.join("\n"),
      kind === "expired" ? /Expired/u : /Stale/u,
    );
  }
});

test("changed exception path issues cannot inherit a formerly accepted risk", async () => {
  const h = auditHarness();
  h.dependencies.args = ["--baseline"];
  h.lockfile.packages[""]!.dependencies = { braces: "*" };
  h.files.set("package-lock.json", Buffer.from(JSON.stringify(h.lockfile)));
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.kind === "exception"));
  assert.equal(h.state.disposed, 1);
});

test("the comparison uses its exception file instead of the changed head record", async () => {
  const h = auditHarness();
  h.dependencies.args = ["--baseline"];
  h.files.set(
    "scripts/verification/dependency-audit-exceptions.json",
    Buffer.from(JSON.stringify([{ ...h.exception, until: "2026-10-02" }])),
  );
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, false);
  assert.equal(h.commands.length, 2);
  assert.match(h.output.errors.join("\n"), /Expired/u);
  assert.equal(h.state.disposed, 1);
});

test("a failing comparison separates inherited notices from new finding errors", async () => {
  const h = auditHarness(true);
  h.dependencies.args = ["--baseline"];
  changeManifest(h.files);
  h.report.vulnerabilities.other = {
    name: "other",
    severity: "high",
    nodes: ["node_modules/other"],
    via: [
      {
        name: "other",
        dependency: "other",
        severity: "high",
        title: "Other issue",
        url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
      },
    ],
  };
  h.head.stdout = JSON.stringify(h.report);
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, false);
  assert.equal(result.mode, "baseline");
  if (result.mode !== "baseline") return;
  const inherited = result.issues.filter((issue) => issue.inherited);
  assert.equal(inherited.length, 1);
  assert.match(h.output.notices.join("\n"), /GHSA-vfj7-8cjw-p6xm/u);
  assert.match(h.output.errors.join("\n"), /GHSA-aaaa-bbbb-cccc/u);
  assert.doesNotMatch(h.output.errors.join("\n"), /GHSA-vfj7-8cjw-p6xm/u);
});
