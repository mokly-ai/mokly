/**
 * The canvas of the routed entry in the wide layout. This container gives
 * `@mokly/ui/canvas-stage` the entry's section and the path chip's copy,
 * binds the canvas's keys, and measures the frames again after each pan and
 * zoom, which fire no scroll or resize event. The canvas is the stage that
 * clips each frame's highlights and markers.
 */

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

import type { CanvasSectionFrame } from "@mokly/ui/canvas-section";
import {
  CanvasStage,
  canvasKeyCommand,
  type CanvasStageHandle,
} from "@mokly/ui/canvas-stage";
import { ChangeStatus, type ChangeStatusValue } from "@mokly/ui/change-status";

import { FrameStageContext } from "./frame_layout_context.js";
import {
  useOptionalShellFrameRegistry,
  type ShellFrameRegistry,
} from "./frame_registry.js";
import { useShellRoot } from "./root_context.js";
import { useShellStore } from "./store_context.js";

/** Whether the canvas shows, which a comparison in its place hides. */
function shown(canvas: HTMLElement): boolean {
  return typeof canvas.checkVisibility === "function"
    ? canvas.checkVisibility()
    : canvas.offsetParent !== null;
}

/**
 * Bind the canvas's keys: on the whole document of a standalone shell, and
 * only on an embedded root, so the host page keeps its own keys. The keys
 * act while the canvas shows.
 */
function useCanvasKeys(
  canvas: RefObject<HTMLDivElement | null>,
  handle: RefObject<CanvasStageHandle | null>,
  embedded: boolean,
): void {
  const root = useShellRoot()?.elements.root;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const target: EventTarget | null | undefined = embedded
      ? root?.current
      : element.ownerDocument;
    if (!target) return;
    const keydown = (event: Event) => {
      const key = event as KeyboardEvent;
      const command = canvasKeyCommand(key);
      if (!command || !shown(element)) return;
      key.preventDefault();
      handle.current?.run(command);
    };
    target.addEventListener("keydown", keydown);
    return () => target.removeEventListener("keydown", keydown);
  }, [canvas, embedded, handle, root]);
}

/**
 * Measure the frames again after a pan or a zoom, once for each animation
 * frame, so highlights, labels and markers follow the frames.
 */
function useGeometryRefresh(
  registry: ShellFrameRegistry | undefined,
): () => void {
  const pending = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (pending.current !== undefined) cancelAnimationFrame(pending.current);
    },
    [],
  );
  return useCallback(() => {
    if (!registry || pending.current !== undefined) return;
    if (typeof requestAnimationFrame !== "function") return;
    pending.current = requestAnimationFrame(() => {
      pending.current = undefined;
      void registry.geometry.refresh().catch(() => undefined);
    });
  }, [registry]);
}

/** The routed entry's section on the canvas. */
export function CanvasEntryStage({
  fitKey,
  frames,
  kind,
  path,
  status,
  title,
}: {
  /** Names the shown section; a new name fits the canvas again. */
  fitKey: string;
  frames: readonly CanvasSectionFrame[];
  kind: "component" | "document" | "screen";
  path: string;
  status?: ChangeStatusValue | undefined;
  title: string;
}) {
  const store = useShellStore();
  const canvas = useRef<HTMLDivElement>(null);
  const handle = useRef<CanvasStageHandle>(null);
  useCanvasKeys(canvas, handle, store.context.embedded ?? false);
  const refresh = useGeometryRefresh(useOptionalShellFrameRegistry());
  return (
    <FrameStageContext value={canvas}>
      <CanvasStage
        canvasRef={canvas}
        fitKey={fitKey}
        onViewChange={refresh}
        ref={handle}
        routed
        section={{
          frames,
          kind,
          onCopyPath: (value) => store.copy(value, `Copied path ${value}`),
          path,
          status: status ? <ChangeStatus status={status} /> : undefined,
          title,
        }}
      />
    </FrameStageContext>
  );
}
