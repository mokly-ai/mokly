/** Asynchronous frame operations behind workspace inspection state. */

import type { ReactNode } from "react";

import type { FrameEvent } from "../client/frame_adapter.js";
import type { GeneratedComponentView } from "../components/views.js";

import type { ShellFrameGeometryController } from "./frame_geometry_controller.js";
import {
  captureFrame,
  currentFrameCapture,
  frameHasInstance,
  validFrameUsage,
  type ShellFrameCapture,
} from "./frame_instances.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";
import type { WorkspaceData } from "./workspace_data.js";

export const WAITING_REASON = "Waiting for the component preview.";

export interface WorkspaceInspectionContext {
  comparisonActive: boolean;
  data: WorkspaceData;
  invalidSelection: boolean;
  views: readonly GeneratedComponentView[];
}

export interface WorkspaceInspectionInput extends WorkspaceInspectionContext {
  onSelect(
    key: string,
    viewport: "desktop" | "mobile",
    openProps?: boolean,
  ): void;
  selectedKey?: string;
}

export interface WorkspaceInspectionResult {
  available: boolean;
  reason?: string;
  highlighting: boolean;
  select(
    key: string,
    viewport: "desktop" | "mobile",
    openProps?: boolean,
  ): void;
  toggle(): void;
  reveal(key: string, viewport: "desktop" | "mobile"): void;
  stop(): void;
  overlay: ReactNode;
}

export interface InspectionAvailability {
  available: boolean;
  reason?: string;
}

interface PresentationInput {
  registry: ShellFrameRegistry;
  sessions: readonly ShellFrameSession[];
  selectedKey?: string;
}

/** Explain the exact reason the current visible workspace cannot inspect. */
export function inspectionAvailability(
  input: WorkspaceInspectionContext,
  sessions: readonly ShellFrameSession[],
): InspectionAvailability {
  if (input.comparisonActive)
    return {
      available: false,
      reason: "Highlighting is available in Current.",
    };
  if (input.invalidSelection || input.data.removed)
    return { available: false, reason: "This preview is unavailable." };
  if (!input.views.length)
    return {
      available: false,
      reason: "Component inspection is unavailable for this view.",
    };
  if (sessions.some((session) => session.status === "error"))
    return { available: false, reason: "This preview could not be loaded." };
  if (
    sessions.length !== input.views.length ||
    sessions.some(
      (session) =>
        session.status === "loading" ||
        !session.mounted ||
        session.usage.status === "pending",
    )
  )
    return { available: false, reason: WAITING_REASON };
  if (
    input.views.some((view) => !view.usage) ||
    sessions.some((session) => !validFrameUsage(session))
  )
    return {
      available: false,
      reason: input.data.viewUsagePending
        ? WAITING_REASON
        : "Component inspection is unavailable for this view.",
    };
  if (
    !sessions.some(
      (session) =>
        session.usage.status === "ready" && session.usage.instances.length,
    )
  )
    return {
      available: false,
      reason: "No registered components are used in this view.",
    };
  return { available: true };
}

/** Serialize one complete mask and geometry presentation. */
export async function presentWorkspaceInspection(
  input: PresentationInput,
  current: () => boolean,
  geometry: ShellFrameGeometryController | undefined,
): Promise<void> {
  const captures = input.sessions.map(captureFrame);
  const ready = await Promise.all(captures.map(({ session }) => session.ready));
  checkPresentation(input.registry, captures, current);
  if (
    captures.some(
      ({ session }) => session.status !== "ready" || !validFrameUsage(session),
    )
  )
    throw new Error("Frame inspection is unavailable.");
  const selected = new Map(
    input.sessions.map((session, index) => [session, ready[index]!]),
  );
  for (const session of input.registry.values()) {
    if (!selected.has(session))
      ignoreFrameOperation(() => session.mounted?.highlight([], "off"));
  }
  await Promise.all(
    input.sessions.map((session) =>
      selected
        .get(session)!
        .highlight(workspaceInspectionKeys(session, input.selectedKey), "pick"),
    ),
  );
  checkPresentation(input.registry, captures, current);
  if (geometry) await geometry.refresh(input.sessions);
  checkPresentation(input.registry, captures, current);
}

function checkPresentation(
  registry: ShellFrameRegistry,
  captures: readonly ShellFrameCapture[],
  current: () => boolean,
): void {
  if (
    !current() ||
    captures.some((capture) => !currentFrameCapture(registry, capture))
  )
    throw new Error("Inspection superseded.");
}

export function workspaceInspectionKeys(
  session: ShellFrameSession,
  selectedKey: string | undefined,
): readonly string[] {
  if (session.usage.status !== "ready") return [];
  return session.usage.instances
    .filter((instance) =>
      selectedKey
        ? instance.key === selectedKey
        : instance.owner.kind === "entry",
    )
    .map((instance) => instance.key);
}

export function receiveWorkspaceFrameEvent(
  event: FrameEvent,
  session: ShellFrameSession,
  highlighting: boolean,
  select: (key: string, viewport: "desktop" | "mobile") => void,
  stop: () => void,
): void {
  if (highlighting && (event.type === "pick-end" || event.type === "error"))
    stop();
  else if (
    event.type === "click" &&
    highlighting &&
    session.identity.viewport &&
    frameHasInstance(session, event.key)
  )
    select(event.key, session.identity.viewport);
}

export function focusWorkspaceHighlightControl(
  frame: HTMLIFrameElement | undefined,
): void {
  queueMicrotask(() =>
    frame
      ?.closest<HTMLElement>("[data-workspace]")
      ?.querySelector<HTMLButtonElement>("[data-workspace-highlight]")
      ?.focus({ preventScroll: true }),
  );
}

function ignoreFrameOperation(
  operation: () => Promise<void> | undefined,
): void {
  try {
    void operation()?.catch(() => undefined);
  } catch {
    return;
  }
}
