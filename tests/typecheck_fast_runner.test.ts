import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  runFastTypecheck,
  type FastTypecheckOptions,
} from "../scripts/verification/typecheck-fast-runner.mjs";

type Outcome = Awaited<
  ReturnType<NonNullable<FastTypecheckOptions["execute"]>>
>;
type ProbeOutcome = Awaited<
  ReturnType<NonNullable<FastTypecheckOptions["probe"]>>
>;
interface Call {
  program: string;
  args: readonly string[];
  cwd: string | undefined;
}

const root = path.resolve("fast typecheck fixture");
const node = path.join(root, "tools/node");
const compiler = path.join(root, "node_modules/typescript/bin/tsc");
const success = { exitCode: 0, signal: null, interrupted: null };
const nativeArgs = ["check", "--no-script", "--all"];
const probeCall = { program: "bun", args: ["--version"], cwd: root };

function expectedCheckerCalls(
  program: string,
  args: readonly string[],
): Call[] {
  return [
    {
      program,
      args: [
        ...args,
        "--project",
        path.join("packages", "mokly", "tsconfig.json"),
      ],
      cwd: root,
    },
    { program, args: [...args, "--project", "tsconfig.json"], cwd: root },
    {
      program,
      args: [...args, "--project", "tsconfig.json"],
      cwd: path.join(root, "packages", "ui"),
    },
    {
      program,
      args: [...args, "--project", "tsconfig.json"],
      cwd: path.join(root, "packages", "viewer"),
    },
    {
      program,
      args: [...args, "--project", "tsconfig.scripts-declarations.json"],
      cwd: root,
    },
  ];
}

function harness(
  options: {
    probeError?: Error;
    probeOutcome?: Partial<ProbeOutcome>;
    checkError?: Error;
    checkOutcome?: Outcome;
  } = {},
) {
  const calls: Call[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    calls,
    stdout,
    stderr,
    run: () =>
      runFastTypecheck({
        root,
        program: node,
        args: [compiler, "--noEmit"],
        probe: async (program, args, settings) => {
          calls.push({ program, args, cwd: settings?.cwd });
          if (options.probeError) throw options.probeError;
          return {
            ...success,
            stdout: "1.4.4\n",
            stderr: "",
            ...options.probeOutcome,
          };
        },
        execute: async (program, args, settings) => {
          calls.push({ program, args, cwd: settings?.cwd });
          if (options.checkError) throw options.checkError;
          return options.checkOutcome ?? success;
        },
        writeStdout: (text) => stdout.push(text),
        writeStderr: (text) => stderr.push(text),
      }),
  };
}

test("fast type checking probes Bun before checking all projects with native flags and existing working directories", async () => {
  for (const version of ["1.4.4", "1.10.0"]) {
    const fixture = harness({ probeOutcome: { stdout: `${version}\n` } });
    assert.equal(await fixture.run(), 0);
    assert.deepEqual(fixture.calls, [
      probeCall,
      ...expectedCheckerCalls("bun", nativeArgs),
    ]);
    assert.deepEqual(fixture.stderr, []);
  }
});

test("missing or older Bun warns and runs the standard checker with its result", async () => {
  const missing = Object.assign(new Error("Bun was not found"), {
    code: "ENOENT",
  });
  for (const availability of [
    { probeError: missing, reason: /not found/i },
    { probeOutcome: { stdout: "1.4.3\n" }, reason: /1\.4\.3.*1\.4\.4/ },
  ]) {
    for (const checkOutcome of [success, { ...success, exitCode: 2 }]) {
      const fixture = harness({ ...availability, checkOutcome });
      assert.equal(await fixture.run(), checkOutcome.exitCode);
      const expected = expectedCheckerCalls(node, [compiler, "--noEmit"]);
      assert.deepEqual(fixture.calls, [
        probeCall,
        ...(checkOutcome.exitCode === 0 ? expected : expected.slice(0, 1)),
      ]);
      assert.match(fixture.stderr.join(""), availability.reason);
      assert.match(fixture.stderr.join(""), /npm install --global bun@1\.4\.4/);
    }
  }
});

test("failed or unusable Bun version probes retain diagnostics and never start a checker", async () => {
  const cases: { outcome: Partial<ProbeOutcome>; expected: number }[] = [
    { outcome: { exitCode: 7 }, expected: 7 },
    { outcome: { exitCode: null, signal: "SIGSEGV" }, expected: 139 },
    { outcome: { interrupted: "SIGINT" }, expected: 130 },
    { outcome: { exitCode: null }, expected: 1 },
    { outcome: { stdout: "unreadable-version\n" }, expected: 1 },
  ];
  for (const { outcome, expected } of cases) {
    const fixture = harness({
      probeOutcome: {
        stdout: "probe stdout\n",
        stderr: "probe stderr\n",
        ...outcome,
      },
    });
    assert.equal(await fixture.run(), expected, JSON.stringify(outcome));
    assert.deepEqual(fixture.calls, [probeCall]);
    assert.equal(fixture.stdout.join(""), outcome.stdout ?? "probe stdout\n");
    assert.match(fixture.stderr.join(""), /^probe stderr\n/);
    assert.doesNotMatch(fixture.stderr.join(""), /npm install/);
  }
});

test("non-missing Bun probe launch errors propagate without a fallback", async () => {
  for (const failure of [
    Object.assign(new Error("permission denied"), { code: "EACCES" }),
    new Error("probe launch failed"),
  ]) {
    const fixture = harness({ probeError: failure });
    await assert.rejects(fixture.run(), (error) => error === failure);
    assert.deepEqual(fixture.calls, [probeCall]);
    assert.deepEqual(fixture.stderr, []);
  }
});

test("a failed, crashed, or interrupted Bun checker stops at the first project without a fallback", async () => {
  const cases: { outcome: Outcome; expected: number }[] = [
    { outcome: { ...success, exitCode: 2 }, expected: 2 },
    { outcome: { ...success, exitCode: null }, expected: 1 },
    {
      outcome: { ...success, exitCode: null, signal: "SIGSEGV" },
      expected: 139,
    },
    { outcome: { ...success, interrupted: "SIGINT" }, expected: 130 },
  ];
  for (const { outcome, expected } of cases) {
    const fixture = harness({ checkOutcome: outcome });
    assert.equal(await fixture.run(), expected, JSON.stringify(outcome));
    assert.deepEqual(fixture.calls, [
      probeCall,
      ...expectedCheckerCalls("bun", nativeArgs).slice(0, 1),
    ]);
    assert.deepEqual(fixture.stderr, []);
  }
});

test("Bun checker launch errors propagate even when Bun disappears after its version probe", async () => {
  for (const failure of [
    Object.assign(new Error("Bun disappeared"), { code: "ENOENT" }),
    Object.assign(new Error("permission denied"), { code: "EACCES" }),
  ]) {
    const fixture = harness({ checkError: failure });
    await assert.rejects(fixture.run(), (error) => error === failure);
    assert.deepEqual(fixture.calls, [
      probeCall,
      ...expectedCheckerCalls("bun", nativeArgs).slice(0, 1),
    ]);
    assert.deepEqual(fixture.stderr, []);
  }
});
