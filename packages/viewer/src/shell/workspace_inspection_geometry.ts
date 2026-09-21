/** Geometry lifecycle for registry-backed workspace inspection. */

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ShellFrameGeometryController } from "./frame_geometry_controller.js";
import type { ShellFrameSession } from "./frame_registry.js";
import { useOptionalShellFrameRegistry } from "./frame_registry.js";

interface GeometryDemand {
  readonly current: readonly ShellFrameSession[];
}

/** Identify changes that invalidate current workspace measurements. */
export function workspaceSessionSignature(
  sessions: readonly ShellFrameSession[],
): string {
  return sessions
    .map(
      (session) =>
        `${session.generation}:${session.usageRevision}:${session.status}`,
    )
    .join("|");
}

/** Join workspace labels to the registry's shared geometry scheduler. */
export function useWorkspaceInspectionGeometry(
  workspace: HTMLElement | null | undefined,
  demand: GeometryDemand,
  setFailed: Dispatch<SetStateAction<boolean>>,
): ShellFrameGeometryController | undefined {
  const registry = useOptionalShellFrameRegistry();
  const geometry = registry?.geometry;
  const owner = useRef({});
  const [, setCycle] = useState(0);
  useEffect(() => {
    const root = workspace?.closest<HTMLElement>("[data-mokly-shell]");
    if (!geometry || !root) return;
    const release = geometry.acquire(owner.current, root, () => demand.current);
    const unsubscribe = geometry.subscribe(setCycle);
    if (demand.current.length)
      void geometry.refresh().catch(() => setFailed(true));
    return () => {
      unsubscribe();
      release();
    };
  }, [geometry, workspace]);
  return geometry;
}
