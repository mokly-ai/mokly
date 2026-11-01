/** Explicit comparison I/O boundary for standalone and embedded shells. */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { SnapshotPresentationEnvironment } from "../previews/presentation.js";
import type { DeploymentCheck } from "../viewer/sources.js";

import type { ScrollTogetherPreference } from "./comparison_scroll_preference.js";

/** A live Serve route or one catalogue-pinned immutable generation root. */
export type ComparisonDelivery =
  { kind: "live" } | { kind: "pinned"; comparisonUrl: string | null };

/** Browser behavior needed by comparison requests, supplied by the host. */
export interface ComparisonEnvironment {
  baseUrl: string | URL;
  delivery(): ComparisonDelivery;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  /** Check the static deployment before opening or renewing a comparison. */
  deploymentCheck?: DeploymentCheck;
  reportError?(error: unknown): void;
  /**
   * The reader's Scroll together choice for this viewer; without one, Scroll
   * together stays on.
   */
  scrollTogether?: ScrollTogetherPreference;
}

const ComparisonEnvironmentContext = createContext<
  ComparisonEnvironment | undefined
>(undefined);

/** Supply the comparison environment of one shell root, when it has one. */
export function ComparisonEnvironmentProvider({
  children,
  environment,
}: {
  children: ReactNode;
  environment?: ComparisonEnvironment;
}) {
  return (
    <ComparisonEnvironmentContext.Provider value={environment}>
      {children}
    </ComparisonEnvironmentContext.Provider>
  );
}

/** Read the comparison boundary owned by the current shell root. */
export function useComparisonEnvironment(): ComparisonEnvironment | undefined {
  return useContext(ComparisonEnvironmentContext);
}

/** The browser boundaries a snapshot loader needs, from the comparison host. */
export function snapshotPresentationEnvironment(
  environment: ComparisonEnvironment,
): SnapshotPresentationEnvironment {
  return {
    baseUrl: environment.baseUrl,
    fetch: (input, init) => environment.fetch(input, init),
    parse: (source) => new DOMParser().parseFromString(source, "text/html"),
  };
}
