/** Declarative labels for registry-backed public viewer inspection. */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { CatalogueReadModel } from "../catalogue/types.js";
import type { Box } from "../client/frame_adapter.js";
import { SupersededFrameGeometry } from "../shell/frame_geometry.js";
import {
  frameEntryKeys,
  frameHasInstance,
  matchesFrameInstance,
} from "../shell/frame_instances.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../shell/frame_registry.js";

import { viewerInspectionLabels } from "./inspection_labels.js";
import type { InstanceRef } from "./types.js";

export type ViewerInspectionPresentation =
  | {
      instances: readonly InstanceRef[];
      kind: "instances";
    }
  | { kind: "pick" };

/** Share the registry geometry scheduler with markers and workspace inspection. */
export function ViewerInspectionLayer({
  model,
  onError,
  onSelect,
  presentation,
  registry,
}: {
  model: CatalogueReadModel;
  onError(error: unknown): void;
  onSelect(
    session: ShellFrameSession,
    key: string,
    boxes: readonly Box[],
  ): void;
  presentation?: ViewerInspectionPresentation;
  registry: ShellFrameRegistry;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const owner = useRef({});
  const demand = useRef<readonly ShellFrameSession[]>([]);
  const reported = useRef(new Set<number>());
  const [, setGeometryCycle] = useState(0);
  const registryRevision = useSyncExternalStore(
    registry.subscribe.bind(registry),
    registry.snapshot,
    () => 0,
  );
  const current = presentation;
  const sessions = useMemo(
    () =>
      current
        ? registry.inspection
            .visibleSessions()
            .filter((session) => sessionKeys(session, current).length > 0)
        : [],
    [current, registry, registryRevision],
  );
  demand.current = sessions;

  useEffect(() => {
    const root = layer.current?.closest<HTMLElement>("[data-mokly-shell]");
    if (!root) return;
    const geometry = registry.geometry;
    const release = geometry.acquire(owner.current, root, () => demand.current);
    const unsubscribe = geometry.subscribe(setGeometryCycle);
    return () => {
      unsubscribe();
      release();
    };
  }, [registry]);

  useEffect(() => {
    if (!sessions.length) return;
    let current = true;
    void registry.geometry.refresh(sessions).catch((error: unknown) => {
      if (current && !(error instanceof SupersededFrameGeometry))
        onError(error);
    });
    return () => {
      current = false;
    };
  }, [onError, registry, sessions]);

  useEffect(() => {
    for (const session of sessions) {
      const snapshot = registry.geometry.snapshot(session);
      if (
        snapshot.result?.kind !== "error" ||
        reported.current.has(snapshot.cycle)
      )
        continue;
      reported.current.add(snapshot.cycle);
      onError(snapshot.result.error);
    }
  });

  const labels =
    current && layer.current
      ? viewerInspectionLabels(
          model,
          layer.current,
          sessions.map((session) => ({
            session,
            keys: sessionKeys(session, current),
          })),
          registry,
        )
      : [];
  return (
    <div
      data-mokly-label-layer=""
      ref={layer}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {labels.map((label) => (
        <button
          className="mbk-highlight-label"
          data-mokly-label-key={label.id}
          key={label.id}
          onClick={() => onSelect(label.session, label.key, label.boxes)}
          style={{ left: label.left, pointerEvents: "auto", top: label.top }}
          type="button"
        >
          {label.text}
        </button>
      ))}
    </div>
  );
}

function sessionKeys(
  session: ShellFrameSession,
  presentation: ViewerInspectionPresentation,
): readonly string[] {
  if (session.usage.status !== "ready") return [];
  if (presentation.kind === "pick") return frameEntryKeys(session);
  return presentation.instances.flatMap((instance) =>
    matchesFrameInstance(session, instance) &&
    frameHasInstance(session, instance.key)
      ? [instance.key]
      : [],
  );
}
