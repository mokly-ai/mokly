import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { prepareFixture } from "../scripts/large/setup.js";
import { setupBudget } from "../scripts/large/setup_budget.js";
import { measureSetup } from "../scripts/large/setup_measurement.js";
import { observeSetup } from "../scripts/large/setup_memory.js";
import type { SetupSystem } from "../scripts/large/setup_memory.js";

import { repositoryRoot } from "./helpers/fixture.js";

test("isolated setup budgets use exclusive synthetic time and RSS boundaries", () => {
  const limitKiB = 1.5 * 1024 * 1024;
  assert.equal(setupBudget(59999, limitKiB - 1), undefined);
  assert.match(setupBudget(60000, limitKiB - 1)!, /under 60000 ms/);
  assert.match(setupBudget(59999, limitKiB)!, /under 1.5 GiB/);
  assert.match(setupBudget(60001, limitKiB + 1)!, /60001 ms.*1572865 KiB/);
  for (const invalid of [-1, NaN, Infinity]) {
    assert.match(setupBudget(invalid, 10)!, /Isolated setup/);
    assert.match(setupBudget(10, invalid)!, /Setup-family RSS/);
  }
});

function fakeSystem() {
  const state = { time: 1000, rss: 100, cancelled: 0, tick: () => {} };
  const system: SetupSystem = {
    pid: 10,
    now: () => state.time,
    ps: async () =>
      `10 1 10 ${state.rss}\n20 10 20 200\n30 20 30 300\n99 1 99 99999999`,
    every: (tick, intervalMs) => {
      assert.equal(intervalMs, 50);
      state.tick = tick;
      return () => {
        state.cancelled++;
      };
    },
  };
  return { state, system };
}

test("setup RSS includes the harness and descendant groups and drains its last sample", async () => {
  const { state, system } = fakeSystem();
  const finish = observeSetup(system, state.time);
  const pending = finish();
  state.rss = 400;
  const result = await pending;
  assert.equal(result.peakKiB, 900);
  assert.equal(result.samples, 2);
  assert.deepEqual(
    result.observations.map((sample) => sample.rssKiB),
    [600, 900],
  );
  assert.equal(state.cancelled, 1);
  state.tick();
  assert.equal(await finish(), result);
  assert.equal(result.samples, 2);
});

test("workspace setup keeps observations without applying isolated budgets or sampling", async () => {
  const { state, system } = fakeSystem();
  const measured = await measureSetup(
    "workspace",
    async () => {
      state.time += 60000;
      return "workspace result";
    },
    {
      ...system,
      ps: async () => assert.fail("workspace RSS is not sampled"),
      every: () => assert.fail("no sampler"),
    },
  );
  assert.deepEqual(measured.outcome, { ok: true, value: "workspace result" });
  assert.equal(measured.measurement.status, "measured");
  assert.equal(measured.measurement.setupMs, 60000);
  assert.equal(measured.measurement.memory, null);
});

test("missing RSS evidence fails setup and releases the sampler", async () => {
  for (const ps of [
    async () => "99 1 99 1",
    async () => {
      throw new Error("ps failed");
    },
  ]) {
    const { state, system } = fakeSystem();
    const observed = await measureSetup("install", async () => "installed", {
      ...system,
      ps,
    });
    assert.equal(observed.measurement.status, "failed");
    assert.match(observed.measurement.reason!, /RSS sampling failed/);
    assert.equal(state.cancelled, 1);
  }
});

test("isolated setup persists results after generation, installation, and Git setup", async (t) => {
  for (const failure of ["pass", "time", "memory", "install"] as const) {
    const root = await fs.mkdtemp(
      path.join(repositoryRoot, ".context/setup-budget-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const { state, system } = fakeSystem();
    const installError = new Error("controlled install failure");
    const setup = prepareFixture(
      repositoryRoot,
      { areas: 1, screens: 2, rows: 1 },
      "html",
      "install",
      root,
      {
        setupSystem: system,
        toolchain: async () => {
          await fs.access(path.join(root, "mokly.config.json"));
          state.time += failure === "time" ? 60000 : 100;
          state.rss = failure === "memory" ? 1.5 * 1024 * 1024 : 100;
          if (failure === "install") throw installError;
          return { mode: "install", installMs: 1 };
        },
      },
    );
    if (failure === "pass") {
      const fixture = await setup;
      assert.equal(fixture.setup?.status, "measured");
    } else
      await assert.rejects(setup, (error) => {
        if (failure === "install") return error === installError;
        assert.match(
          String(error),
          failure === "time" ? /under 60000 ms/ : /under 1.5 GiB/,
        );
        return true;
      });
    const saved = JSON.parse(
      await fs.readFile(path.join(root, ".context/setup.json"), "utf8"),
    );
    assert.equal(saved.status, failure === "pass" ? "measured" : "failed");
    assert.ok(saved.memory.samples > 0);
    assert.equal(state.cancelled, 1);
    if (failure !== "install") {
      const fixture = JSON.parse(
        await fs.readFile(path.join(root, ".context/fixture.json"), "utf8"),
      );
      assert.match(fixture.baseline, /^[a-f0-9]{40}$/);
      assert.deepEqual(fixture.setup, saved);
      assert.equal(fixture.setupMs, saved.setupMs);
    }
  }
});
