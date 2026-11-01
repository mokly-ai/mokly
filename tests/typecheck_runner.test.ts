import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  runTypecheck,
  type TypecheckOptions,
} from "../scripts/verification/typecheck-runner.mjs";

const root = path.resolve("typecheck fixture");
const node = path.join(root, "tools/node");
const compiler = path.join(root, "node_modules/typescript/bin/tsc");
const success = { exitCode: 0, signal: null, interrupted: null };

function run(execute: NonNullable<TypecheckOptions["execute"]>) {
  return runTypecheck({
    root,
    program: node,
    args: [compiler, "--noEmit"],
    execute,
  });
}

test("standard type checking runs all five projects in order with their working directories", async () => {
  const calls: {
    program: string;
    args: readonly string[];
    cwd: string | undefined;
    active: number;
  }[] = [];
  let active = 0;
  const result = await run(async (program, args, options) => {
    active += 1;
    calls.push({ program, args, cwd: options?.cwd, active });
    await Promise.resolve();
    active -= 1;
    return success;
  });
  assert.equal(result, 0);
  assert.deepEqual(calls, [
    {
      program: node,
      args: [
        compiler,
        "--noEmit",
        "--project",
        path.join("packages", "mokly", "tsconfig.json"),
      ],
      cwd: root,
      active: 1,
    },
    {
      program: node,
      args: [compiler, "--noEmit", "--project", "tsconfig.json"],
      cwd: root,
      active: 1,
    },
    {
      program: node,
      args: [compiler, "--noEmit", "--project", "tsconfig.json"],
      cwd: path.join(root, "packages", "ui"),
      active: 1,
    },
    {
      program: node,
      args: [compiler, "--noEmit", "--project", "tsconfig.json"],
      cwd: path.join(root, "packages", "viewer"),
      active: 1,
    },
    {
      program: node,
      args: [
        compiler,
        "--noEmit",
        "--project",
        "tsconfig.scripts-declarations.json",
      ],
      cwd: root,
      active: 1,
    },
  ]);
});

test("type checking stops at the first failed, signalled, or interrupted project", async () => {
  const cases: {
    outcome: Awaited<ReturnType<NonNullable<TypecheckOptions["execute"]>>>;
    expected: number;
  }[] = [
    { outcome: { exitCode: 2, signal: null, interrupted: null }, expected: 2 },
    {
      outcome: { exitCode: null, signal: null, interrupted: null },
      expected: 1,
    },
    {
      outcome: { exitCode: null, signal: "SIGTERM", interrupted: null },
      expected: 143,
    },
    {
      outcome: { exitCode: 0, signal: null, interrupted: "SIGINT" },
      expected: 130,
    },
  ];
  for (const { outcome, expected } of cases) {
    const projects: string[] = [];
    const result = await run(async (_program, args) => {
      projects.push(args.at(-1) ?? "");
      return projects.length === 2 ? outcome : success;
    });
    assert.equal(result, expected, JSON.stringify(outcome));
    assert.deepEqual(projects, [
      path.join("packages", "mokly", "tsconfig.json"),
      "tsconfig.json",
    ]);
  }
});

test("type checking propagates a launch error without a retry or another project", async () => {
  const failure = new Error("compiler launch failed");
  let calls = 0;
  await assert.rejects(
    run(async () => {
      calls += 1;
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
});
