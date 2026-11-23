/**
 * A comparison host that holds each selection, renewal and deployment check
 * until the test answers it, and the comparison controller of the fixture's
 * component workspace, rendered against that host.
 */

import assert from "node:assert/strict";

import { renderHook } from "@testing-library/react";

import { VIEWER_DIRECTORY } from "@mokly/model";

import type {
  ComparisonDelivery,
  ComparisonEnvironment,
} from "../src/shell/comparison_context.js";
import type { ComparisonFrameDemand } from "../src/shell/comparison_presentation.js";
import {
  useComparison,
  type ComparisonOptions,
} from "../src/shell/use_comparison.js";

import { indexFixture } from "./catalogue_v9_fixture.js";
import { ShellStoreFixture } from "./shell_markup.js";

/** The origin of the host and of every generation. */
export const ORIGIN = "https://catalogue.test";

/** The fixture's component, whose workspace owns every row of its variant set. */
export const ACTION = "components/action";
/** The fixture's saved variant of the component. */
export const DEFAULT = "components/action/default";
/** A row that only the frames name. */
export const OUTLINE = "components/action/outline";

/** The root of a generation that a selection redirects to, by its name. */
export function generationRoot(name: string): string {
  return `${ORIGIN}/${VIEWER_DIRECTORY}/diffs/generations/${name}/`;
}

/** The pinned delivery of the fixture's packaged comparison, and its root. */
export function pinnedDelivery(): {
  delivery: ComparisonDelivery;
  root: string;
} {
  const { comparisonUrl } = indexFixture();
  assert.ok(comparisonUrl);
  return {
    delivery: { kind: "pinned", comparisonUrl },
    root: new URL(comparisonUrl, `${ORIGIN}/`).href,
  };
}

/** A frame of a variant set's row: the row's desktop view of one scheme. */
export function frame(
  path: string,
  scheme: "dark" | "light",
): ComparisonFrameDemand {
  return {
    entry: { path },
    key: `${path}:${scheme}`,
    scheme,
    viewport: "desktop",
  };
}

/** One request that the host holds until the test answers it. */
export interface HeldRequest {
  /**
   * `GET {path}` for a selection, with ` refresh` for Refresh and Try again,
   * `HEAD {generation}` for a renewal, or the method and the path of another
   * address.
   */
  label: string;
  signal: AbortSignal;
  /** Answer with the generation root that the request reached. */
  answer(root: string): void;
  /** End the request with a network failure. */
  fail(error: unknown): void;
}

function label(url: URL, method: string): string {
  if (method === "HEAD")
    return `HEAD ${url.pathname.split("/").at(-2) ?? url.pathname}`;
  if (url.pathname === `/${VIEWER_DIRECTORY}/diffs/selection`) {
    const refresh = url.searchParams.get("refresh") === "1" ? " refresh" : "";
    return `GET ${url.searchParams.get("path") ?? ""}${refresh}`;
  }
  return `${method} ${url.pathname}`;
}

function response(url: string): Response {
  const value = new Response(null, { status: 204 });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

/**
 * A host whose requests wait for the test. A held request ignores its abort
 * signal, as a response that is already on its way does, so a test can send
 * the late response of a cancelled request.
 */
export function heldHost(
  delivery: ComparisonDelivery = { kind: "live" },
  deploymentCheck?: ComparisonEnvironment["deploymentCheck"],
) {
  const requests: HeldRequest[] = [];
  const reported: unknown[] = [];
  const environment: ComparisonEnvironment = {
    baseUrl: ORIGIN,
    delivery: () => delivery,
    fetch: (input, init) =>
      new Promise<Response>((resolve, reject) => {
        const url = new URL(String(input));
        requests.push({
          label: label(url, init?.method ?? "GET"),
          signal: init?.signal ?? new AbortController().signal,
          answer: (root) => resolve(response(root)),
          fail: reject,
        });
      }),
    reportError: (error) => reported.push(error),
    ...(deploymentCheck ? { deploymentCheck } : {}),
  };
  return {
    environment,
    /** The labels of every request, in the order they were sent. */
    labels: () => requests.map((request) => request.label),
    reported,
    requests,
  };
}

/** Render the controller of the fixture's component workspace. */
export function renderComparison(
  environment: ComparisonEnvironment,
  initialProps: ComparisonOptions,
) {
  return renderHook((props: ComparisonOptions) => useComparison(props), {
    initialProps,
    wrapper: ({ children }) => (
      <ShellStoreFixture
        comparisonEnvironment={environment}
        path={`/view/${ACTION}/`}
      >
        {children}
      </ShellStoreFixture>
    ),
  });
}
