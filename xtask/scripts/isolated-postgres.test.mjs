import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { runIsolatedSuite } from "./isolated-postgres.mjs";

function fixture(command) {
  const statements = [];
  const urls = [];
  let sequence = 0;
  return {
    statements,
    urls,
    dependencies: {
      environment: {
        MKC_TEST_DATABASE_URL: "postgres://tester:password@localhost/base",
      },
      nextId: () => (++sequence).toString(16).padStart(32, "0"),
      signals: new EventEmitter(),
      log: () => {},
      sql: (statement) => statements.push(statement),
      command: async (spec, env, signal) => {
        urls.push(env.MKC_TEST_DATABASE_URL);
        return command(spec, env, signal);
      },
    },
  };
}

test("each invocation gets its own database and a failed command still drops it", async () => {
  const setup = fixture(() => 7);
  const plan = [{ program: "probe", args: [], environment: [] }];
  for (let run = 0; run < 2; run++)
    assert.equal(
      await runIsolatedSuite("cloud-rust", plan, setup.dependencies),
      7,
    );
  assert.notEqual(setup.urls[0], setup.urls[1]);
  assert.match(setup.urls[0], /\/mkc_gate_cloud_rust_[a-f0-9]{32}$/);
  assert.equal(setup.statements.length, 4);
  for (let run = 0; run < 2; run++) {
    const name = new URL(setup.urls[run]).pathname.slice(1);
    assert.equal(setup.statements[run * 2], `CREATE DATABASE "${name}"`);
    assert.equal(
      setup.statements[run * 2 + 1],
      `DROP DATABASE "${name}" WITH (FORCE)`,
    );
  }
});

test("interrupts stop the current command, drop its database, and stop the plan", async () => {
  for (const [signal, status] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    const setup = fixture((_spec, _env, interruption) => {
      setup.dependencies.signals.emit(signal);
      assert.equal(interruption.reason, signal);
      return 0;
    });
    const plan = Array(2).fill({ program: "probe", args: [], environment: [] });
    assert.equal(
      await runIsolatedSuite("cloud-app", plan, setup.dependencies),
      status,
    );
    assert.equal(setup.urls.length, 1);
    assert.match(setup.statements.at(-1), /^DROP DATABASE /);
    assert.equal(setup.dependencies.signals.listenerCount(signal), 0);
  }
});

test("command errors drop the database and command overrides cannot replace its URL", async () => {
  const setup = fixture((_spec, env) => {
    assert.equal(env.CI, "1");
    assert.equal(env.REMOVE_ME, undefined);
    assert.match(env.MKC_TEST_DATABASE_URL, /\/mkc_gate_cloud_desktop_/);
    throw new Error("probe failed to start");
  });
  setup.dependencies.environment.REMOVE_ME = "inherited";
  await assert.rejects(
    runIsolatedSuite(
      "cloud-desktop",
      [
        {
          program: "probe",
          args: [],
          environment: [
            ["CI", "1"],
            ["REMOVE_ME", null],
            ["MKC_TEST_DATABASE_URL", "postgres://localhost/shared"],
          ],
        },
      ],
      setup.dependencies,
    ),
    /probe failed to start/,
  );
  assert.match(setup.statements.at(-1), /^DROP DATABASE /);
});
