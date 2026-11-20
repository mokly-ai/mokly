import assert from "node:assert/strict";
import { test } from "node:test";

import type { Billing } from "../../api/types";
import { readUntilTeam } from "../../settings/panes/billing-watch";

import { billingRead, settle } from "./billing-watch-harness";

test("a pending billing read ends at the deadline and ignores a late Team answer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const stalled = Promise.withResolvers<Billing>();
  const accepted: string[] = [];
  const results: (boolean | undefined)[] = [];
  const failures: unknown[] = [];
  void readUntilTeam(
    () => stalled.promise,
    (value) => void accepted.push(value.plan),
    () => true,
  ).then(
    (value) => void results.push(value),
    (caught) => void failures.push(caught),
  );

  t.mock.timers.tick(29_999);
  await settle();
  assert.deepEqual(results, []);
  assert.deepEqual(accepted, []);
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(results, [false]);

  stalled.resolve(billingRead("team"));
  await settle();
  assert.deepEqual(accepted, []);
  assert.deepEqual(results, [false]);
  assert.deepEqual(failures, []);
});

test("the billing deadline ends a pause and starts no further read", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const first = Promise.withResolvers<Billing>();
  const accepted: string[] = [];
  const results: (boolean | undefined)[] = [];
  let reads = 0;
  void readUntilTeam(
    () => {
      reads += 1;
      return first.promise;
    },
    (value) => void accepted.push(value.plan),
    () => true,
  ).then((value) => void results.push(value));

  t.mock.timers.tick(29_000);
  first.resolve(billingRead("free"));
  await settle();
  assert.deepEqual(accepted, ["free"]);
  assert.equal(reads, 1);
  t.mock.timers.tick(999);
  await settle();
  assert.deepEqual(results, []);
  t.mock.timers.tick(1);
  await settle();
  assert.deepEqual(results, [false]);

  t.mock.timers.tick(1_000);
  await settle();
  assert.equal(reads, 1);
  assert.deepEqual(accepted, ["free"]);
});
