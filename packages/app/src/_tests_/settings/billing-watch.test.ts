import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestContext } from "node:test";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import type { Billing } from "../../api/types";
import { useFocusReads } from "../../settings/panes/billing-watch";
import { shellPage, withWindowAsync } from "../page-window";

// React runs effects inside `act` only in an act environment.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function read(plan: Billing["plan"]): Billing {
  return {
    plan,
    seats: [],
    subscription: null,
    manageable: true,
    checkoutAvailable: plan === "free",
  };
}

/** Let every settled read and its follow-up steps run. */
async function settle() {
  for (let step = 0; step < 10; step += 1) {
    await new Promise((done) => setImmediate(done));
  }
}

/**
 * The Billing pane's focus reads, rendered by React DOM in this Node process
 * in the desktop app's window, with a fake clock. Each read answers the next
 * plan of `plans`, or rejects when that plan is `"fail"`. The log records each
 * read, each accepted plan and each reload, in order.
 */
function pane(t: TestContext, plans: readonly (Billing["plan"] | "fail")[]) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const log: string[] = [];
  const focus = new Set<() => void>();
  const page = Object.assign(new EventTarget(), {
    location: shellPage(),
    addEventListener: (type: string, listener: () => void) =>
      type === "focus" && focus.add(listener),
    removeEventListener: (type: string, listener: () => void) =>
      focus.delete(listener),
    // React DOM reads these two of the page while it commits.
    event: undefined,
    HTMLIFrameElement: class {},
  });
  const fragment = Object.assign(new EventTarget(), {
    nodeType: 11,
    nodeName: "#document-fragment",
    ownerDocument: new EventTarget(),
    textContent: "",
    firstChild: null,
  });
  let reads = 0;
  const readPlan = () => {
    const plan = plans[Math.min(reads, plans.length - 1)];
    reads += 1;
    log.push("read");
    return plan === "fail"
      ? Promise.reject(new Error("unavailable"))
      : Promise.resolve(read(plan));
  };
  let watchCheckout = () => undefined as void;
  function Pane() {
    watchCheckout = useFocusReads(
      "workspace",
      readPlan,
      (value) => void log.push("accept " + value.plan),
      () => void log.push("reload"),
    );
    return null;
  }
  const root = createRoot(fragment as unknown as DocumentFragment);
  return {
    log,
    page,
    mount: () => act(() => root.render(createElement(Pane))),
    unmount: () => act(() => root.unmount()),
    opened: () => watchCheckout(),
    focus: () => [...focus].forEach((listener) => listener()),
    reads: () => reads,
  };
}

test("a plain focus reads once", async (t) => {
  const subject = pane(t, ["free"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.focus();
    await settle();
    assert.deepEqual(subject.log, ["reload"]);
    subject.unmount();
  });
});

test("the first focus after Checkout reads until Team, then focus reads once", async (t) => {
  const subject = pane(t, ["free", "free", "team"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    assert.deepEqual(subject.log, ["read", "accept free"]);

    // Focus while the wait runs starts nothing else.
    subject.focus();
    await settle();
    assert.equal(subject.log.length, 2);

    t.mock.timers.tick(2_000);
    await settle();
    t.mock.timers.tick(2_000);
    await settle();
    assert.deepEqual(subject.log.slice(2), [
      "read",
      "accept free",
      "read",
      "accept team",
    ]);

    t.mock.timers.tick(2_000);
    await settle();
    assert.equal(subject.reads(), 3, "no read follows Team");
    subject.focus();
    await settle();
    assert.equal(subject.log.at(-1), "reload");
    subject.unmount();
  });
});

test("the wait after Checkout ends after thirty seconds of Free", async (t) => {
  const subject = pane(t, ["free"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    for (let second = 0; second < 40; second += 2) {
      t.mock.timers.tick(2_000);
      await settle();
    }
    // One read at the start and one every two seconds up to the thirtieth.
    assert.equal(subject.reads(), 16);
    assert.ok(!subject.log.includes("reload"));
    subject.focus();
    await settle();
    assert.equal(subject.log.at(-1), "reload");
    subject.unmount();
  });
});

test("a failed read in the wait hands over to the pane's own read", async (t) => {
  const subject = pane(t, ["free", "fail"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    t.mock.timers.tick(2_000);
    await settle();
    assert.deepEqual(subject.log, ["read", "accept free", "read", "reload"]);
    subject.unmount();
  });
});

test("leaving the pane ends the wait", async (t) => {
  const subject = pane(t, ["free"]);
  await withWindowAsync(subject.page, async () => {
    subject.mount();
    subject.opened();
    subject.focus();
    await settle();
    subject.unmount();
    t.mock.timers.tick(10_000);
    await settle();
    assert.deepEqual(subject.log, ["read", "accept free"]);
  });
});
