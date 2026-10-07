import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { runDependencyAudit } from "../scripts/verification/dependency-audit.mjs";

import {
  auditHarness,
  changeManifest,
} from "./helpers/dependency_audit_runner.js";

test("head report and input issues stop the baseline and print every head issue", async () => {
  for (const kind of [
    "exit",
    "exceptions",
    "clock",
    "signal",
    "parse",
    "launch",
  ]) {
    const h = auditHarness(true);
    h.dependencies.args = ["--baseline"];
    if (kind === "exit") h.head.exitCode = 0;
    if (kind === "exceptions")
      h.files.set(
        "scripts/verification/dependency-audit-exceptions.json",
        Buffer.from("{}"),
      );
    if (kind === "clock") h.dependencies.clock = () => new Date("bad");
    if (kind === "signal") h.head.signal = "SIGTERM";
    if (kind === "parse")
      h.files.set("package-lock.json", Buffer.from("invalid JSON"));
    if (kind === "launch")
      h.dependencies.runCommand = async () => {
        throw new Error("npm unavailable");
      };
    const result = await runDependencyAudit(h.dependencies);
    assert.equal(result.ok, false, kind);
    assert.ok(
      result.issues.some(
        (issue) => issue.kind === "input" || issue.kind === "report",
      ),
      kind,
    );
    assert.equal(h.events.includes("resolve-base"), false, kind);
    assert.ok(h.commands.length <= 1, kind);
    assert.ok(
      result.issues.every((issue) => h.output.errors.includes(issue.message)),
      kind,
    );
    assert.doesNotMatch(h.output.notices.join("\n"), /Inherited/u);
  }
});

test("comparison resolution wraps ratchet errors with audit fetch actions and Git causes", async () => {
  const h = auditHarness(true);
  h.dependencies.args = ["--baseline"];
  h.dependencies.baseline.resolveComparisonCommit = async () => {
    throw new Error("Repository ratchet command failed: git merge-base", {
      cause: new Error("origin/main is unavailable"),
    });
  };
  assert.equal((await runDependencyAudit(h.dependencies)).ok, false);
  const output = h.output.errors.join("\n");
  assert.match(output, /Dependency audit.*comparison commit/su);
  assert.match(output, /git fetch origin main/u);
  assert.match(output, /Repository ratchet.*origin\/main is unavailable/su);
  assert.equal(h.state.temporary, 0);
});

test("a missing comparison file fails closed even with otherwise identical bytes", async () => {
  for (const file of [
    "package.json",
    "package-lock.json",
    "scripts/verification/dependency-audit-exceptions.json",
  ]) {
    const h = auditHarness(true);
    h.dependencies.args = ["--baseline"];
    h.baseFiles.delete(file);
    assert.equal((await runDependencyAudit(h.dependencies)).ok, false);
    assert.ok(h.output.errors.join("\n").includes(file));
    assert.match(h.output.errors.join("\n"), /fetch.*retry/su);
    assert.equal(h.commands.length, 1);
    assert.equal(h.state.temporary, 0);
  }
});

test("every baseline operational failure fails closed and disposes its directory", async () => {
  for (const kind of [
    "registry",
    "json",
    "exit",
    "signal",
    "launch",
    "clock-file",
  ]) {
    const h = auditHarness(true);
    h.dependencies.args = ["--baseline"];
    changeManifest(h.files);
    if (kind === "registry") h.base.stdout = '{"error":{"code":"E503"}}';
    if (kind === "json") h.base.stdout = "registry unavailable";
    if (kind === "exit") h.base.exitCode = 0;
    if (kind === "signal") h.base.signal = "SIGTERM";
    if (kind === "clock-file")
      h.baseFiles.set(
        "scripts/verification/dependency-audit-exceptions.json",
        Buffer.from("{}"),
      );
    if (kind === "launch") {
      const run = h.dependencies.runCommand;
      h.dependencies.runCommand = async (command) => {
        if (command.cwd !== "/repo")
          throw new Error("baseline npm unavailable");
        return run(command);
      };
    }
    const result = await runDependencyAudit(h.dependencies);
    assert.equal(result.ok, false, kind);
    assert.ok(
      result.issues.some(
        (issue) => issue.kind === "input" || issue.kind === "report",
      ),
      kind,
    );
    assert.equal(h.state.disposed, 1, kind);
    assert.match(h.output.errors.join("\n"), /comparison|baseline/u);
    assert.doesNotMatch(h.output.notices.join("\n"), /Inherited/u);
  }
});

test("temporary creation, writing and disposal failures are actionable input issues", async () => {
  for (const kind of ["create", "write", "dispose"]) {
    const h = auditHarness(true);
    h.dependencies.args = ["--baseline"];
    changeManifest(h.files);
    const create = h.dependencies.baseline.makeTemporaryDirectory;
    h.dependencies.baseline.makeTemporaryDirectory = async () => {
      if (kind === "create") throw new Error("temporary creation denied");
      const directory = await create();
      if (kind === "write")
        directory.writeFile = async () => {
          throw new Error("temporary write denied");
        };
      if (kind === "dispose")
        directory.dispose = async () => {
          h.state.disposed++;
          throw new Error("temporary disposal denied");
        };
      return directory;
    };
    const result = await runDependencyAudit(h.dependencies);
    assert.equal(result.ok, false, kind);
    assert.ok(
      result.issues.some((issue) => issue.kind === "input"),
      kind,
    );
    assert.equal(h.state.disposed, kind === "create" ? 0 : 1, kind);
    assert.match(h.output.errors.join("\n"), /temporary.*retry/su);
  }
});
