import type { TestContext } from "node:test";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import type { Billing } from "../../api/types";
import { useFocusReads } from "../../settings/panes/billing-watch";
import { shellPage } from "../page-window";

// React runs effects inside `act` only in an act environment.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

export function billingRead(plan: Billing["plan"]): Billing {
  return {
    plan,
    seats: [],
    subscription: null,
    manageable: true,
    checkoutAvailable: plan === "free",
  };
}

/** Let every settled read and its follow-up steps run. */
export async function settle() {
  for (let step = 0; step < 10; step += 1) {
    await new Promise((done) => setImmediate(done));
  }
}

/**
 * The Billing pane's focus reads, rendered by React DOM in this Node process
 * in the desktop app's window, with a fake clock. Each read answers the next
 * plan of `plans`, waits for its promise, or rejects for `"fail"`. The log
 * records each read, each accepted plan and each reload, in order.
 */
export function pane(
  t: TestContext,
  plans: readonly (Billing["plan"] | "fail" | Promise<Billing>)[],
) {
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
      : typeof plan === "string"
        ? Promise.resolve(billingRead(plan))
        : plan;
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
