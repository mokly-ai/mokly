import assert from "node:assert/strict";
import { test } from "node:test";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import type { Billing } from "../../api/types";
import {
  ResourceInvalidationProvider,
  projectResourceScope,
  resourceInvalidationVersion,
  useResourceInvalidationVersions,
  workspaceResourceScope,
} from "../../data/resource-invalidation";
import { useReconcilePlan } from "../../settings/panes/billing-reconcile";
import { tabAt, withWindow } from "../page-window";

const workspaceId = "01994f10-0000-7000-8000-000000000077";
const projectId = "01994f10-0000-7000-8000-000000000088";

function read(plan: Billing["plan"]): Billing {
  return {
    plan,
    seats: [],
    subscription: null,
    manageable: true,
    checkoutAvailable: plan === "free",
  };
}

/**
 * The Billing pane's reconciliation, rendered by React DOM in this Node
 * process inside the invalidation boundary, with a probe that records the
 * workspace and project invalidation versions after each commit.
 */
function pane() {
  const versions: number[][] = [];
  const page = Object.assign(new EventTarget(), {
    location: tabAt(),
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
  function Probe() {
    const all = useResourceInvalidationVersions();
    versions.push([
      resourceInvalidationVersion(all, [workspaceResourceScope(workspaceId)]),
      resourceInvalidationVersion(all, [projectResourceScope(projectId)]),
    ]);
    return null;
  }
  function Pane({ value }: { value: Billing | undefined }) {
    // A new project object on every render, as the invalidation gives the
    // real pane, must not start another invalidation.
    const project = { id: projectId };
    useReconcilePlan(value, workspaceId, project.id);
    return null;
  }
  const root = createRoot(fragment as unknown as DocumentFragment);
  const show = (value: Billing | undefined) =>
    act(() =>
      root.render(
        createElement(
          ResourceInvalidationProvider,
          null,
          createElement(Pane, { value }),
          createElement(Probe),
        ),
      ),
    );
  return { page, versions, show, unmount: () => act(() => root.unmount()) };
}

// React runs effects inside `act` only in an act environment.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("each new Team read invalidates the workspace and project reads once", () => {
  const subject = pane();
  withWindow(subject.page, () => {
    try {
      const free = read("free");
      subject.show(free);
      subject.show(free);
      const before = subject.versions.at(-1)!;

      // The read again on window focus after a payment in the browser.
      const team = read("team");
      subject.show(team);
      const after = subject.versions.at(-1)!;
      assert.ok(after[0] > before[0], "the workspace reads are invalidated");
      assert.ok(after[1] > before[1], "the project reads are invalidated");

      // Rendering the same read again, as a refresh in flight does, does not.
      subject.show(team);
      assert.deepEqual(subject.versions.at(-1), after);
      assert.deepEqual(before, subject.versions[0]);
    } finally {
      subject.unmount();
    }
  });
});
