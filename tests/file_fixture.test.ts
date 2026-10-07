import assert from "node:assert/strict";
import test from "node:test";

import { fileFixture } from "./helpers/file_fixture.js";

function hookCollector() {
  const hooks: (() => Promise<void>)[] = [];
  return {
    hooks,
    register: (hook: () => Promise<void>): void => {
      hooks.push(hook);
    },
    teardown: (): Promise<void> => {
      assert.equal(hooks.length, 1);
      const [hook] = hooks;
      assert.ok(hook);
      return hook();
    },
  };
}

test("one teardown registers synchronously without starting unused setup", async () => {
  const collector = hookCollector();
  let setups = 0;
  fileFixture(async () => {
    setups += 1;
    return "value";
  }, collector.register);
  assert.equal(collector.hooks.length, 1);
  assert.equal(setups, 0);
  await collector.teardown();
  assert.equal(setups, 0);
});

test("first use memoizes one promise and value across concurrent callers", async () => {
  const collector = hookCollector();
  let setups = 0;
  const value = { id: "shared" };
  const fixture = fileFixture(async () => {
    setups += 1;
    return value;
  }, collector.register);
  const first = fixture();
  const second = fixture();
  assert.equal(first, second);
  assert.deepEqual(await Promise.all([first, second]), [value, value]);
  assert.equal(await fixture(), value);
  assert.equal(setups, 1);
  await collector.teardown();
});

test("teardown waits for setup to register cleanup before removing output", async () => {
  const collector = hookCollector();
  let settle: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const events: string[] = [];
  const fixture = fileFixture(async (owner) => {
    await waiting;
    owner.after(async () => {
      events.push("cleanup");
    });
    events.push("setup");
    return "value";
  }, collector.register);
  const pending = fixture();
  const teardown = collector.teardown();
  await Promise.resolve();
  assert.deepEqual(events, []);
  assert.ok(settle);
  settle();
  assert.equal(await pending, "value");
  await teardown;
  assert.deepEqual(events, ["setup", "cleanup"]);
});

test("setup failure is memoized and cleanup still runs after it settles", async () => {
  const collector = hookCollector();
  const failure = new Error("setup failed");
  const events: string[] = [];
  let setups = 0;
  const fixture = fileFixture(async (owner) => {
    setups += 1;
    owner.after(async () => {
      events.push("cleanup");
    });
    throw failure;
  }, collector.register);
  const pending = fixture();
  const observed = assert.rejects(pending, (error) => error === failure);
  const teardown = collector.teardown();
  await observed;
  await teardown;
  assert.equal(fixture(), pending);
  assert.equal(setups, 1);
  assert.deepEqual(events, ["cleanup"]);
});

test("synchronous setup failure becomes the shared rejected promise", async () => {
  const collector = hookCollector();
  const failure = new Error("synchronous setup failure");
  const fixture = fileFixture<string>(() => {
    throw failure;
  }, collector.register);
  const pending = fixture();
  await assert.rejects(pending, (error) => error === failure);
  assert.equal(fixture(), pending);
  await collector.teardown();
});

test("teardown awaits reverse-order cleanups before continuing", async () => {
  const collector = hookCollector();
  let settle: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const events: string[] = [];
  const fixture = fileFixture(async (owner) => {
    owner.after(async () => {
      events.push("first");
    });
    owner.after(async () => {
      events.push("second-start");
      await waiting;
      events.push("second-end");
    });
    return "value";
  }, collector.register);
  await fixture();
  const teardown = collector.teardown();
  await Promise.resolve();
  assert.deepEqual(events, ["second-start"]);
  assert.ok(settle);
  settle();
  await teardown;
  assert.deepEqual(events, ["second-start", "second-end", "first"]);
});

test("a cleanup failure does not skip earlier cleanups and keeps its identity", async () => {
  const collector = hookCollector();
  const failure = new Error("cleanup failed");
  const events: string[] = [];
  const fixture = fileFixture(async (owner) => {
    owner.after(async () => {
      events.push("first");
    });
    owner.after(async () => {
      events.push("second");
      throw failure;
    });
    owner.after(async () => {
      events.push("third");
    });
    return "value";
  }, collector.register);
  await fixture();
  await assert.rejects(collector.teardown(), (error) => error === failure);
  assert.deepEqual(events, ["third", "second", "first"]);
});

test("multiple cleanup failures are reported after every cleanup is attempted", async () => {
  const collector = hookCollector();
  const first = new Error("first failed");
  const second = new Error("second failed");
  const events: string[] = [];
  const fixture = fileFixture(async (owner) => {
    owner.after(async () => {
      events.push("first");
      throw first;
    });
    owner.after(async () => {
      events.push("second");
      throw second;
    });
    return "value";
  }, collector.register);
  await fixture();
  await assert.rejects(collector.teardown(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [second, first]);
    return true;
  });
  assert.deepEqual(events, ["second", "first"]);
});

test("cleanup failures still propagate after failed setup", async () => {
  const collector = hookCollector();
  const setupFailure = new Error("setup failed");
  const cleanupFailure = new Error("cleanup failed");
  const fixture = fileFixture(async (owner) => {
    owner.after(async () => {
      throw cleanupFailure;
    });
    throw setupFailure;
  }, collector.register);
  await assert.rejects(fixture(), (error) => error === setupFailure);
  await assert.rejects(
    collector.teardown(),
    (error) => error === cleanupFailure,
  );
});
