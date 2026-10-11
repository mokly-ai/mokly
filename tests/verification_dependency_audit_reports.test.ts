import assert from "node:assert/strict";
import test from "node:test";

import { runDependencyAudit } from "../scripts/verification/dependency-audit.mjs";

import { auditHarness } from "./helpers/dependency_audit_runner.js";

test("unknown arguments and missing report paths fail before any npm or input read", async () => {
  for (const args of [
    ["--unknown"],
    ["--report"],
    ["--report", "--baseline"],
  ]) {
    const h = auditHarness();
    h.dependencies.args = args;
    assert.equal((await runDependencyAudit(h.dependencies)).ok, false);
    assert.deepEqual(h.commands, []);
    assert.deepEqual(h.events, []);
    assert.equal(h.state.clocks, 0);
  }
});

test("both modes write JSON summaries on success and findings failures", async () => {
  for (const baseline of [false, true]) {
    for (const fail of [false, true]) {
      const h = auditHarness(fail);
      h.dependencies.args = [
        "--report",
        "audit.json",
        ...(baseline ? ["--baseline"] : []),
      ];
      if (baseline && fail)
        h.dependencies.baseline.resolveComparisonCommit = async () => {
          throw new Error("Git unavailable");
        };
      const result = await runDependencyAudit(h.dependencies);
      const summary = h.reports.get("audit.json");
      assert.ok(summary);
      assert.equal(summary.mode, baseline ? "baseline" : "strict");
      assert.equal(summary.ok, result.ok);
      assert.equal(summary.ok, !fail);
      assert.deepEqual(summary.issues, result.issues);
      assert.equal(Object.hasOwn(summary, "notices"), false);
      if (summary.mode === "baseline")
        assert.ok(
          summary.issues.every((issue) => typeof issue.inherited === "boolean"),
        );
      else
        assert.ok(
          summary.issues.every((issue) => !Object.hasOwn(issue, "inherited")),
        );
    }
  }
});

test("inherited baseline report keeps its comparison commit and structured notices", async () => {
  const h = auditHarness(true);
  h.dependencies.args = ["--baseline", "--report", "audit.json"];
  const result = await runDependencyAudit(h.dependencies);
  assert.equal(result.ok, true);
  const report = h.reports.get("audit.json");
  assert.equal(report?.mode, "baseline");
  if (report?.mode !== "baseline") return;
  assert.equal(report.comparisonCommit, "base");
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0]!.inherited, true);
});

test("launch and registry failures still write completed-run summaries", async () => {
  for (const kind of ["launch", "registry"]) {
    const h = auditHarness();
    h.dependencies.args = ["--report", "audit.json"];
    if (kind === "launch")
      h.dependencies.runCommand = async () => {
        throw new Error("Cannot start npm");
      };
    else h.head.stdout = '{"error":{"code":"E503"}}';
    await runDependencyAudit(h.dependencies);
    assert.equal(h.reports.get("audit.json")?.ok, false);
    assert.ok(
      h.reports
        .get("audit.json")!
        .issues.some(
          (issue) => issue.kind === (kind === "launch" ? "input" : "report"),
        ),
    );
  }
});

test("summary write failures become input issues and cannot print a pass line", async () => {
  for (const mode of ["strict", "baseline"]) {
    const h = auditHarness();
    h.dependencies.args = [
      "--report",
      "audit.json",
      ...(mode === "baseline" ? ["--baseline"] : []),
    ];
    h.dependencies.writeReport = async () => {
      throw new Error("directory is read-only");
    };
    const result = await runDependencyAudit(h.dependencies);
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.kind === "input"));
    assert.match(h.output.errors.join("\n"), /audit.json.*read-only/su);
    assert.doesNotMatch(h.output.notices.join("\n"), /audit passed/u);
  }
});
