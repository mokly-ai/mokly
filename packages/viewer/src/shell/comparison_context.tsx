/** Explicit comparison I/O boundary for standalone and embedded shells. */

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import type { ShellContext } from "./context.js";
import { readShellDelivery } from "./delivery.js";

/** A live Serve route or one catalogue-pinned immutable metadata file. */
export type ComparisonDelivery =
  { kind: "live" } | { kind: "pinned"; comparisonUrl: string | null };

/** Browser behavior needed by comparison requests, supplied by the host. */
export interface ComparisonEnvironment {
  baseUrl: string | URL;
  delivery(): ComparisonDelivery;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  initialMode?(): "side" | undefined;
  reportError?(error: unknown): void;
}

const ComparisonEnvironmentContext = createContext<
  ComparisonEnvironment | undefined
>(undefined);

/** Supply an explicit environment or the standalone document integration. */
export function ComparisonEnvironmentProvider({
  children,
  context,
  environment,
  interactive,
}: {
  children: ReactNode;
  context: ShellContext;
  environment?: ComparisonEnvironment;
  interactive: boolean;
}) {
  const standalone = useMemo(
    () => standaloneEnvironment(context, interactive),
    [context.delivery, interactive],
  );
  return (
    <ComparisonEnvironmentContext.Provider value={environment ?? standalone}>
      {children}
    </ComparisonEnvironmentContext.Provider>
  );
}

/** Read the comparison boundary owned by the current shell root. */
export function useComparisonEnvironment(): ComparisonEnvironment | undefined {
  return useContext(ComparisonEnvironmentContext);
}

function standaloneEnvironment(
  context: ShellContext,
  interactive: boolean,
): ComparisonEnvironment | undefined {
  if (
    !interactive ||
    typeof document === "undefined" ||
    typeof window === "undefined"
  )
    return;
  return {
    baseUrl: window.location.origin,
    delivery: context.delivery
      ? () => ({
          kind: "pinned",
          comparisonUrl: readShellDelivery(document)?.comparisonUrl ?? null,
        })
      : () => ({ kind: "live" }),
    fetch: (input, init) => window.fetch(input, init),
    initialMode: () =>
      new URL(window.location.href).searchParams.get("comparison") === "side"
        ? "side"
        : undefined,
  };
}
