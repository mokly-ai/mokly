import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  runRequiredTypecheck,
  type RequiredTypecheckOptions,
} from "../scripts/verification/typecheck-ci-runner.mjs";

type Outcome = Awaited<
  ReturnType<NonNullable<RequiredTypecheckOptions["execute"]>>
>;
type ProbeOutcome = Awaited<
  ReturnType<NonNullable<RequiredTypecheckOptions["probe"]>>
>;
type Call =
  | { file: string }
  | { program: string; args: readonly string[]; cwd: string | undefined };

const root = path.resolve("required typecheck fixture");
const success = { exitCode: 0, signal: null, interrupted: null };
const pinCall = { file: path.join(root, ".bun-version") };
const probeCall = { program: "bun", args: ["--version"], cwd: root };
const nativeArgs = ["check", "--no-script", "--all", "--project"];
const firstProject = {
  program: "bun",
  args: [...nativeArgs, path.join("packages", "mokly", "tsconfig.json")],
  cwd: root,
};
const installHint = /npm install --global bun@1\.4\.4/;

function harness(
  options: {
    pin?: string;
    pinError?: Error;
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
      runRequiredTypecheck({
        root,
        program: "standard-node",
        args: ["standard-tsc", "--noEmit"],
        readFile: async (file) => {
          calls.push({ file });
          if (options.pinError) throw options.pinError;
          return options.pin ?? "1.4.4\n";
        },
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

test("required type checking reads the pin before probing Bun and checks all five projects with native flags", async () => {
  for (const { version, message } of [
    {
      version: "1.4.4",
      message: "Using Bun 1.4.4 for required native type checking.\n",
    },
    {
      version: "1.5.0",
      message: "Using Bun 1.5.0 for required native type checking.\n",
    },
  ]) {
    const fixture = harness({
      pin: `${version}\n`,
      probeOutcome: { stdout: `${version}\n` },
    });
    assert.equal(await fixture.run(), 0);
    assert.deepEqual(fixture.calls, [
      pinCall,
      probeCall,
      firstProject,
      { program: "bun", args: [...nativeArgs, "tsconfig.json"], cwd: root },
      {
        program: "bun",
        args: [...nativeArgs, "tsconfig.json"],
        cwd: path.join(root, "packages", "ui"),
      },
      {
        program: "bun",
        args: [...nativeArgs, "tsconfig.json"],
        cwd: path.join(root, "packages", "viewer"),
      },
      {
        program: "bun",
        args: [...nativeArgs, "tsconfig.scripts-declarations.json"],
        cwd: root,
      },
    ]);
    assert.equal(fixture.stdout.join(""), message);
    assert.deepEqual(fixture.stderr, []);
  }
});

test("required type checking rejects unreadable or invalid pins before launching Bun", async () => {
  for (const input of [
    { pinError: Object.assign(new Error("missing pin"), { code: "ENOENT" }) },
    {
      pinError: Object.assign(new Error("unreadable pin"), { code: "EACCES" }),
    },
    ...["", "bad pin", "1.4", "^1.4.4", "v1.4.4", "1.4.4\n1.5.0"].map(
      (pin) => ({ pin }),
    ),
  ]) {
    const fixture = harness(input);
    assert.equal(await fixture.run(), 1, JSON.stringify(input));
    assert.deepEqual(fixture.calls, [pinCall]);
    assert.match(fixture.stderr.join(""), /\.bun-version/);
    assert.doesNotMatch(fixture.stderr.join(""), /npm install/);
  }
});

test("required type checking rejects missing, different, or malformed Bun without a fallback", async () => {
  const cases = [
    {
      probeError: Object.assign(new Error("missing Bun"), { code: "ENOENT" }),
      reason: /missing Bun/,
    },
    {
      probeError: Object.assign(new Error("unreadable Bun"), {
        code: "EACCES",
      }),
      reason: /unreadable Bun/,
    },
    { probeOutcome: { stdout: "1.4.3\n" }, reason: /1\.4\.3.*1\.4\.4/ },
    { probeOutcome: { stdout: "1.5.0\n" }, reason: /1\.5\.0.*1\.4\.4/ },
    { probeOutcome: { stdout: "bad version\n" }, reason: /Bun version/ },
  ];
  for (const input of cases) {
    const fixture = harness(input);
    assert.equal(await fixture.run(), 1, JSON.stringify(input));
    assert.deepEqual(fixture.calls, [pinCall, probeCall]);
    assert.match(fixture.stderr.join(""), input.reason);
    assert.match(fixture.stderr.join(""), installHint);
  }
});

test("required type checking preserves failed probe diagnostics and process results", async () => {
  const cases: { outcome: Partial<ProbeOutcome>; expected: number }[] = [
    { outcome: { exitCode: 7 }, expected: 7 },
    { outcome: { exitCode: null }, expected: 1 },
    { outcome: { exitCode: null, signal: "SIGSEGV" }, expected: 139 },
    { outcome: { interrupted: "SIGINT" }, expected: 130 },
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
    assert.deepEqual(fixture.calls, [pinCall, probeCall]);
    assert.equal(fixture.stdout.join(""), "probe stdout\n");
    assert.match(fixture.stderr.join(""), /^probe stderr\n/);
    assert.match(fixture.stderr.join(""), installHint);
  }
});

test("required type checking preserves the first unsuccessful checker result without a fallback", async () => {
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
    assert.deepEqual(fixture.calls, [pinCall, probeCall, firstProject]);
    assert.deepEqual(fixture.stderr, []);
  }
});

test("required type checking propagates checker launch errors without another project", async () => {
  for (const failure of [
    Object.assign(new Error("Bun disappeared"), { code: "ENOENT" }),
    Object.assign(new Error("permission denied"), { code: "EACCES" }),
  ]) {
    const fixture = harness({ checkError: failure });
    await assert.rejects(fixture.run(), (error) => error === failure);
    assert.deepEqual(fixture.calls, [pinCall, probeCall, firstProject]);
    assert.deepEqual(fixture.stderr, []);
  }
});
