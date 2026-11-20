import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

interface InvalidationBoundary {
  versions: ReadonlyMap<string, number>;
  invalidate: (scopes: readonly string[]) => void;
}

const emptyVersions = new Map<string, number>();
const noInvalidation: InvalidationBoundary = {
  versions: emptyVersions,
  invalidate: () => undefined,
};
const Context = createContext<InvalidationBoundary>(noInvalidation);

/** Canonical invalidation key for reads derived from a workspace. */
export function workspaceResourceScope(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

/** Canonical invalidation key for reads derived from a project. */
export function projectResourceScope(projectId: string): string {
  return `project:${projectId}`;
}

/** Combined generation of the keys one mounted resource consumes. */
export function resourceInvalidationVersion(
  versions: ReadonlyMap<string, number>,
  scopes: readonly string[],
): number {
  return [...new Set(scopes)].reduce(
    (version, scope) => version + (versions.get(scope) ?? 0),
    0,
  );
}

/** Share resource generations across the active route and settings overlay. */
export function ResourceInvalidationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [versions, setVersions] =
    useState<ReadonlyMap<string, number>>(emptyVersions);
  const invalidate = useCallback((scopes: readonly string[]) => {
    const unique = [...new Set(scopes.filter((scope) => scope.length > 0))];
    if (unique.length === 0) return;
    setVersions((current) => {
      const next = new Map(current);
      for (const scope of unique) {
        next.set(scope, (next.get(scope) ?? 0) + 1);
      }
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ versions, invalidate }),
    [versions, invalidate],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Invalidate every mounted resource tagged with any supplied canonical key. */
export function useInvalidateResources(): (scopes: readonly string[]) => void {
  return useContext(Context).invalidate;
}

/** Current keyed generations consumed by the shared resource hook. */
export function useResourceInvalidationVersions(): ReadonlyMap<string, number> {
  return useContext(Context).versions;
}
