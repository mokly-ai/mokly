import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import type { TestContext } from "node:test";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Middleware } from "openapi-fetch";
import { act, createElement, useLayoutEffect } from "react";
import type { Root } from "react-dom/client";

import type { Billing, Project, Workspace } from "../../api/types";
import {
  ResourceInvalidationProvider,
  projectResourceScope,
  resourceInvalidationVersion,
  useResourceInvalidationVersions,
  workspaceResourceScope,
} from "../../data/resource-invalidation";
import { shellPage } from "../page-window";

const workspace: Workspace = {
  id: "01994f10-0000-7000-8000-000000000077",
  name: "Acme",
  slug: "acme",
  role: "owner",
  plan: "free",
  githubInstallationState: "absent",
  version: 1,
};
const project: Project = {
  id: "01994f10-0000-7000-8000-000000000088",
  workspaceId: workspace.id,
  name: "Catalogue",
  slug: "catalogue",
  workspaceSlug: workspace.slug,
  repository: "acme/catalogue",
  configPath: "mokly.config.json",
  visibility: "public",
  requireApproval: false,
  canAdmin: true,
  publishingAllowed: true,
  automaticBuilds: false,
  buildsAvailable: false,
  canRequestBuilds: false,
  version: 1,
};
const free: Billing = {
  plan: "free",
  seats: [],
  subscription: null,
  manageable: true,
  checkoutAvailable: true,
};
const team: Billing = {
  ...free,
  plan: "team",
  checkoutAvailable: false,
  subscription: {
    status: "active",
    trialEnd: null,
    currentPeriodEnd: "2030-10-15T12:00:00Z",
    cancelAtPeriodEnd: false,
    paymentFailedAt: null,
  },
};
export const checkoutUrl = "https://checkout.stripe.com/c/pay/cs_test";

/** Real pane and hooks in a shell page, with answers at the HTTP boundary. */
export async function billingPane(t: TestContext) {
  const routerDouble = new URL("../press-doubles.ts", import.meta.url).href;
  const resolver = registerHooks({
    resolve(specifier, context, next) {
      return specifier === "expo-router"
        ? { url: routerDouble, shortCircuit: true }
        : next(specifier, context);
    },
  });
  GlobalRegistrator.register({
    url: shellPage().origin + "/acme/catalogue?settings=billing",
  });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  const mounted: { root?: Root } = {};
  t.after(async () => {
    await act(() => mounted.root?.unmount());
    t.mock.timers.reset();
    await GlobalRegistrator.unregister();
    resolver.deregister();
  });
  const opened: unknown[][] = [];
  t.mock.method(window, "open", (...given: unknown[]) => {
    opened.push(given);
    return null;
  });
  const matchMedia = window.matchMedia.bind(window);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  Object.defineProperty(reducedMotion, "matches", { value: true });
  t.mock.method(window, "matchMedia", (query: string) =>
    query === "(prefers-reduced-motion: reduce)"
      ? reducedMotion
      : matchMedia(query),
  );

  const { api } = await import("../../api/client");
  const { BillingPane } = await import("../../settings/panes/billing-pane");
  const { createRoot } = await import("react-dom/client");
  const reads: string[] = [];
  const writes: string[] = [];
  const interceptor: Middleware = {
    onRequest({ request, schemaPath, params }) {
      assert.equal(params.path?.workspaceId, workspace.id);
      if (
        request.method === "GET" &&
        schemaPath === "/v1/workspaces/{workspaceId}/billing"
      ) {
        const value = reads.length < 2 ? free : team;
        reads.push(value.plan);
        return Response.json(value);
      }
      assert.equal(request.method, "POST");
      assert.equal(schemaPath, "/v1/workspaces/{workspaceId}/billing/checkout");
      writes.push("checkout");
      return Response.json({ url: checkoutUrl });
    },
  };
  api.use(interceptor);
  t.after(() => api.eject(interceptor));

  let versions = [0, 0];
  function InvalidationProbe() {
    const all = useResourceInvalidationVersions();
    useLayoutEffect(() => {
      versions = [
        resourceInvalidationVersion(all, [
          workspaceResourceScope(workspace.id),
        ]),
        resourceInvalidationVersion(all, [projectResourceScope(project.id)]),
      ];
    }, [all]);
    return null;
  }
  const mount = document.createElement("div");
  document.body.append(mount);
  const root = createRoot(mount);
  mounted.root = root;
  return {
    reads,
    writes,
    opened,
    versions: () => versions,
    control(testID: string) {
      const control = mount.querySelector<HTMLElement>(
        `[data-testid="${testID}"]`,
      );
      assert.ok(control, testID + " is rendered");
      return control;
    },
    async mount() {
      await act(async () => {
        root.render(
          createElement(
            ResourceInvalidationProvider,
            null,
            createElement(BillingPane, { workspace, project }),
            createElement(InvalidationProbe),
          ),
        );
      });
    },
    focus: () => act(async () => window.dispatchEvent(new Event("focus"))),
    tick: (milliseconds: number) =>
      act(async () => t.mock.timers.tick(milliseconds)),
  };
}
