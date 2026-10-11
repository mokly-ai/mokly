import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { npmAuditCommand } from "../scripts/verification/dependency-audit-command.mjs";
import type { AuditCommandResult } from "../scripts/verification/dependency-audit-command.mjs";
import { runDependencyAudit } from "../scripts/verification/dependency-audit.mjs";

import { auditFixture } from "./helpers/dependency_audit.js";

function harness() {
  const { report, lockfile, exception, today } = auditFixture();
  const files = new Map([
    ["package-lock.json", Buffer.from(JSON.stringify(lockfile))],
    [
      "scripts/verification/dependency-audit-exceptions.json",
      Buffer.from(JSON.stringify([exception])),
    ],
  ]);
  const output: { notices: string[]; errors: string[] } = {
    notices: [],
    errors: [],
  };
  const result: AuditCommandResult = {
    stdout: JSON.stringify(report),
    stderr: "",
    exitCode: 1,
    signal: null,
  };
  const commands: unknown[] = [];
  const dependencies = {
    command: npmAuditCommand({
      npmExecPath: "/tools/npm-cli.js",
      nodeExecPath: "/tools/node",
      cwd: "/repo",
      platform: "linux",
    }),
    clock: () => today,
    readFile: async (file: string) => {
      const value = files.get(file);
      if (value === undefined) throw new Error(`missing ${file}`);
      return value;
    },
    runCommand: async (command: unknown) => {
      commands.push(command);
      return result;
    },
    logger: {
      notice: (message: string) => output.notices.push(message),
      error: (message: string) => output.errors.push(message),
    },
  };
  return { dependencies, output, result, commands, files };
}

test("runner uses injected IO, clock, logger, and all audit categories", async () => {
  const { dependencies, output, commands } = harness();
  assert.equal((await runDependencyAudit(dependencies)).ok, true);
  assert.deepEqual(commands, [
    {
      file: "/tools/node",
      args: [
        "/tools/npm-cli.js",
        "audit",
        "--json",
        "--audit-level=low",
        "--package-lock-only",
        "--include=prod",
        "--include=dev",
        "--include=optional",
        "--include=peer",
        "--prefix",
        ".",
      ],
      cwd: "/repo",
      shell: false,
    },
  ]);
  assert.match(output.notices.join("\n"), /Accepted dependency risk/u);
  assert.match(output.notices.join("\n"), /GHSA-vfj7-8cjw-p6xm/u);
  assert.deepEqual(output.errors, []);
});

for (const platform of ["darwin", "win32"]) {
  test(`npm CLI paths with spaces are single arguments on ${platform}`, () => {
    const command = npmAuditCommand({
      npmExecPath: "C:/Program Files/npm/npm-cli.js",
      nodeExecPath: "C:/Program Files/node.exe",
      cwd: "/repo",
      platform,
    });
    assert.equal(command.file, "C:/Program Files/node.exe");
    assert.equal(command.args[0], "C:/Program Files/npm/npm-cli.js");
    assert.equal(command.shell, false);
  });
}

test("standalone invocation has a platform-compatible npm fallback", () => {
  for (const platform of ["linux", "darwin", "win32"]) {
    const command = npmAuditCommand({
      nodeExecPath: "/node",
      cwd: "/repo",
      platform,
    });
    assert.equal(command.file, "npm");
    assert.equal(command.args[0], "audit");
    assert.equal(command.shell, platform === "win32");
  }
});

for (const exitCode of [2, 127, null]) {
  test(`unexpected npm exit ${exitCode} fails even with a covered report`, async () => {
    const { dependencies, result, output } = harness();
    result.exitCode = exitCode;
    assert.equal((await runDependencyAudit(dependencies)).ok, false);
    assert.match(output.errors.join("\n"), /exit|status/u);
  });
}

test("signal exit fails even when the exit code is otherwise accepted", async () => {
  const { dependencies, result } = harness();
  result.signal = "SIGTERM";
  assert.equal((await runDependencyAudit(dependencies)).ok, false);
});

test("npm error JSON and non-JSON output cannot pass", async () => {
  for (const stdout of [
    "",
    "registry unavailable",
    JSON.stringify({
      error: { code: "E503", summary: "registry unavailable" },
    }),
  ]) {
    const { dependencies, result, output } = harness();
    result.stdout = stdout;
    assert.equal((await runDependencyAudit(dependencies)).ok, false);
    assert.ok(output.errors.length > 0);
    assert.match(output.errors.join("\n"), /registry|JSON/u);
  }
});

test("exit code must agree with the report before exceptions apply", async () => {
  const { dependencies, result } = harness();
  result.exitCode = 0;
  assert.equal((await runDependencyAudit(dependencies)).ok, false);
  result.stdout = JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {},
  });
  result.exitCode = 1;
  dependencies.readFile = async (file) =>
    Buffer.from(file === "package-lock.json" ? '{"packages": {"": {}}}' : "[]");
  assert.equal((await runDependencyAudit(dependencies)).ok, false);
});

test("runner accepts clean reports and large JSON output", async () => {
  const { dependencies, result, files } = harness();
  result.exitCode = 0;
  result.stdout = JSON.stringify({
    auditReportVersion: 2,
    vulnerabilities: {},
    padding: "x".repeat(10 * 1024 * 1024),
  });
  files.set(
    "scripts/verification/dependency-audit-exceptions.json",
    Buffer.from("[]"),
  );
  assert.equal((await runDependencyAudit(dependencies)).ok, true);
});

test("file read and parse failures identify the file and required action", async () => {
  for (const file of [
    "package-lock.json",
    "scripts/verification/dependency-audit-exceptions.json",
  ]) {
    for (const action of ["missing", "malformed"]) {
      const { dependencies, files, output } = harness();
      if (action === "missing") files.delete(file);
      else files.set(file, Buffer.from("not-json"));
      assert.equal((await runDependencyAudit(dependencies)).ok, false);
      assert.ok(output.errors.join("\n").includes(file));
      assert.match(output.errors.join("\n"), /Fix|Restore|Retry/u);
    }
  }
});

test("transport exceptions fail with an actionable message", async () => {
  const { dependencies, output } = harness();
  dependencies.runCommand = async () => {
    throw new Error("network unavailable");
  };
  assert.equal((await runDependencyAudit(dependencies)).ok, false);
  assert.match(output.errors.join("\n"), /network unavailable/u);
  assert.match(output.errors.join("\n"), /Retry/u);
});
