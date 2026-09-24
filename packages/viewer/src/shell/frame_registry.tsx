/** React-scoped ownership for mounted consumer frames. */

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { GeneratedPathPrefix } from "../catalogue/delivery_paths.js";
import type { CatalogueUsage } from "../catalogue/types.js";
import type {
  FrameAdapter,
  FrameEvent,
  MountedFrame,
} from "../client/frame_adapter.js";
import { sameOriginAdapter } from "../client/same_origin_adapter.js";

import { ShellFrameGeometryController } from "./frame_geometry_controller.js";
import { ShellInspectionController } from "./frame_inspection_controller.js";

/** Complete identity of one frame rendered by the current shell route. */
export interface ShellFrameIdentity {
  colorScheme?: "dark" | "light";
  entryId: string;
  route: string;
  stepIndex?: number;
  variantId?: string;
  viewport?: "desktop" | "mobile";
}

/** A mounted session exposed to inspection and marker hooks. */
export interface ShellFrameSession {
  readonly controller: AbortController;
  readonly element: HTMLIFrameElement;
  readonly generation: number;
  identity: ShellFrameIdentity;
  mounted?: MountedFrame;
  ready: Promise<MountedFrame>;
  source: string;
  status: "error" | "loading" | "ready";
  usage: CatalogueUsage;
  usageRevision: number;
}

type RegistryListener = () => void;
type FrameEventListener = (
  session: ShellFrameSession,
  event: FrameEvent,
) => void;

/** Per-shell registry; sessions never leak across independent viewer roots. */
export class ShellFrameRegistry {
  private readonly sessions = new Set<ShellFrameSession>();
  private readonly listeners = new Set<RegistryListener>();
  private readonly eventListeners = new Set<FrameEventListener>();
  private generation = 0;
  private revision = 0;
  readonly geometry: ShellFrameGeometryController;
  readonly inspection: ShellInspectionController;

  constructor(
    readonly adapter: FrameAdapter,
    readonly baseUrl?: string | URL,
    readonly generatedPathPrefix?: GeneratedPathPrefix,
  ) {
    this.geometry = new ShellFrameGeometryController(this);
    this.inspection = new ShellInspectionController(this);
  }

  /** Snapshot the sessions currently owned by this shell. */
  values(): readonly ShellFrameSession[] {
    return [...this.sessions];
  }

  /** Observe mount, update, readiness, and disposal changes. */
  subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Observe authenticated events together with the session that emitted them. */
  subscribeEvents(listener: FrameEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /** Stable scalar snapshot for React external-store subscriptions. */
  snapshot = (): number => this.revision;

  emit(session: ShellFrameSession, event: FrameEvent): void {
    if (!this.sessions.has(session)) return;
    if (event.type === "geometry")
      void this.geometry.refresh([session]).catch(() => undefined);
    for (const listener of this.eventListeners) listener(session, event);
  }

  add(session: ShellFrameSession): void {
    this.sessions.add(session);
    this.changed();
  }

  nextGeneration(): number {
    this.generation += 1;
    return this.generation;
  }

  remove(session: ShellFrameSession): void {
    if (this.sessions.delete(session)) this.changed();
  }

  changed(): void {
    this.revision += 1;
    this.geometry.sync();
    for (const listener of this.listeners) listener();
  }
}

const FrameRegistryContext = createContext<ShellFrameRegistry | undefined>(
  undefined,
);

/** Supply isolated adapter ownership to one shell component tree. */
export function ShellFrameRegistryProvider({
  adapter,
  baseUrl,
  children,
  generatedPathPrefix,
}: {
  adapter?: FrameAdapter;
  baseUrl?: string | URL;
  children: ReactNode;
  generatedPathPrefix?: GeneratedPathPrefix;
}) {
  const [localAdapter] = useState(sameOriginAdapter);
  const selected = adapter ?? localAdapter;
  const registry = useMemo(
    () => new ShellFrameRegistry(selected, baseUrl, generatedPathPrefix),
    [baseUrl, generatedPathPrefix, selected],
  );
  return (
    <FrameRegistryContext.Provider value={registry}>
      {children}
    </FrameRegistryContext.Provider>
  );
}

/** Read the current frame registry when the stage is live. */
export function useOptionalShellFrameRegistry():
  ShellFrameRegistry | undefined {
  return useContext(FrameRegistryContext);
}

/** Read the one inspection controller shared by this shell root. */
export function useOptionalShellInspectionController():
  ShellInspectionController | undefined {
  return useOptionalShellFrameRegistry()?.inspection;
}
