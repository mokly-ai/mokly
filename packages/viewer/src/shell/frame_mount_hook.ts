/** React lifecycle hook for one adapter-owned consumer frame. */

import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";

import { currentDocumentRoute } from "../catalogue/delivery_paths.js";
import type { CatalogueUsage } from "../catalogue/types.js";
import type { FrameAdapter, FrameEvent } from "../client/frame_adapter.js";
import { FrameError } from "../client/frame_error.js";
import { cancelFrameMount } from "../client/frame_mount.js";

import { runFrameCleanup } from "./frame_cleanup.js";
import {
  adoptedFrameReadiness,
  mountedFrameReadiness,
} from "./frame_readiness.js";
import {
  type ShellFrameIdentity,
  type ShellFrameRegistry,
  type ShellFrameSession,
  useOptionalShellFrameRegistry,
} from "./frame_registry.js";

export type ShellFrameStatus = "error" | "loading" | "ready" | "unavailable";

interface MountedFrameInput {
  adapter?: FrameAdapter;
  enabled: boolean;
  identity: ShellFrameIdentity;
  onEvent?(event: FrameEvent): void;
  source: string | undefined;
  usage: CatalogueUsage;
}

interface ActiveSession extends ShellFrameSession {
  appliedUsageRevision: number;
  initializing: boolean;
  rejectReady(error: unknown): void;
  unsubscribe?: () => void;
  updates: Promise<void>;
  replacing?: boolean;
}

/** Mount one frame and adopt evidence without replacing its DOM element. */
export function useMountedShellFrame(input: MountedFrameInput): {
  frameRef: RefObject<HTMLIFrameElement | null>;
  status: ShellFrameStatus;
} {
  const registry = useOptionalShellFrameRegistry();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const active = useRef<ActiveSession | undefined>(undefined);
  const latestEvent = useRef(input.onEvent);
  const latestIdentity = useRef(input.identity);
  const latestUsage = useRef(input.usage);
  const [replacement, replace] = useReducer((value: number) => value + 1, 0);
  const [status, setStatus] = useState<ShellFrameStatus>(() =>
    input.enabled && input.source
      ? "loading"
      : input.source
        ? "ready"
        : "unavailable",
  );
  latestEvent.current = input.onEvent;
  latestIdentity.current = input.identity;
  latestUsage.current = input.usage;

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!registry || !input.enabled || !input.source || !element) {
      setStatus(input.source ? "ready" : "unavailable");
      return;
    }
    const controller = new AbortController();
    const readiness = mountedFrameReadiness();
    const session: ActiveSession = {
      appliedUsageRevision: 0,
      controller,
      element,
      generation: registry.nextGeneration(),
      identity: latestIdentity.current,
      initializing: true,
      ready: readiness.promise,
      rejectReady: readiness.reject,
      source: input.source,
      status: "loading",
      updates: Promise.resolve(),
      usage: latestUsage.current,
      usageRevision: 0,
    };
    void session.ready.catch(() => undefined);
    active.current = session;
    registry.add(session);
    setStatus("loading");
    const receive = (event: FrameEvent) => {
      if (controller.signal.aborted) return;
      if (event.type === "error") {
        session.status = "error";
        setStatus("error");
        registry.changed();
      }
      registry.emit(session, event);
      latestEvent.current?.(event);
    };
    const url = new URL(
      input.source,
      registry.baseUrl ?? element.ownerDocument.baseURI,
    );
    let mountedUsageRevision = session.usageRevision;
    void Promise.resolve()
      .then(() => {
        mountedUsageRevision = session.usageRevision;
        return (input.adapter ?? registry.adapter).mount(element, {
          ...(registry.generatedPathPrefix
            ? { generatedPathPrefix: registry.generatedPathPrefix }
            : {}),
          ...(currentDocumentRoute(url.pathname, registry.generatedPathPrefix)
            ? {
                route: currentDocumentRoute(
                  url.pathname,
                  registry.generatedPathPrefix,
                )!,
              }
            : {}),
          onEvent: receive,
          signal: controller.signal,
          url,
          usage: session.usage,
        });
      })
      .then(async (mounted) => {
        if (controller.signal.aborted || active.current !== session) {
          runFrameCleanup([
            () => mounted.dispose(),
            () => cancelFrameMount(element),
          ]);
          return;
        }
        session.mounted = mounted;
        session.appliedUsageRevision = mountedUsageRevision;
        session.unsubscribe = mounted.subscribe(receive);
        registry.changed();
        const synchronized = await synchronizeMountedUsage(
          registry,
          session,
          replace,
        );
        if (!synchronized) return;
        session.initializing = false;
        readiness.resolve(mounted);
        if (!controller.signal.aborted && active.current === session) {
          session.status = "ready";
          setStatus("ready");
          registry.changed();
        }
      })
      .catch((error: unknown) => {
        readiness.reject(error);
        if (!controller.signal.aborted && active.current === session) {
          session.status = "error";
          setStatus("error");
          registry.changed();
        }
      });
    return () => disposeSession(registry, session, active);
  }, [input.adapter, input.enabled, input.source, registry, replacement]);

  useEffect(() => {
    const session = active.current;
    if (!session) return;
    if (!sameFrameIdentity(session.identity, input.identity)) {
      session.identity = input.identity;
      registry?.changed();
    }
    if (session.usage !== input.usage)
      void (registry
        ? adoptUsage(registry, session, input.usage, replace, setStatus)
        : undefined);
  }, [input.identity, input.usage, registry]);

  return { frameRef, status };
}

async function adoptUsage(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  usage: CatalogueUsage,
  replace: () => void,
  setStatus: (status: ShellFrameStatus) => void,
): Promise<void> {
  const revision = ++session.usageRevision;
  session.usage = usage;
  const mounted = session.mounted;
  if (!mounted || session.initializing) {
    registry.changed();
    return;
  }
  if (!mounted.updateUsage) {
    registry.changed();
    if (!session.replacing) {
      session.replacing = true;
      replace();
    }
    return;
  }
  const update = session.updates
    .catch(() => undefined)
    .then(async () => {
      if (
        session.controller.signal.aborted ||
        session.usageRevision !== revision
      )
        return;
      await mounted.updateUsage!(usage);
      session.appliedUsageRevision = Math.max(
        session.appliedUsageRevision,
        revision,
      );
    });
  session.updates = update;
  const readiness = adoptedFrameReadiness(
    session.controller.signal,
    update.then(() => mounted),
  );
  session.rejectReady(new FrameError("disposed"));
  session.ready = readiness.promise;
  session.rejectReady = readiness.reject;
  void session.ready.catch(() => undefined);
  registry.changed();
  await update.then(
    () => {
      if (
        !session.controller.signal.aborted &&
        session.usageRevision === revision
      ) {
        setStatus("ready");
        session.status = "ready";
        registry.changed();
      }
    },
    () => {
      if (
        !session.controller.signal.aborted &&
        session.usageRevision === revision
      ) {
        setStatus("error");
        session.status = "error";
        registry.changed();
      }
    },
  );
}

async function synchronizeMountedUsage(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  replace: () => void,
): Promise<boolean> {
  const mounted = session.mounted;
  if (!mounted) return false;
  while (
    !session.controller.signal.aborted &&
    session.appliedUsageRevision < session.usageRevision
  ) {
    if (!mounted.updateUsage) {
      if (!session.replacing) {
        session.replacing = true;
        replace();
      }
      return false;
    }
    const revision = session.usageRevision;
    try {
      await mounted.updateUsage(session.usage);
      session.appliedUsageRevision = revision;
      registry.changed();
    } catch (error) {
      if (revision === session.usageRevision) throw error;
    }
  }
  return !session.controller.signal.aborted;
}

function sameFrameIdentity(
  current: ShellFrameIdentity,
  next: ShellFrameIdentity,
): boolean {
  return (
    current.colorScheme === next.colorScheme &&
    current.entryId === next.entryId &&
    current.route === next.route &&
    current.stepIndex === next.stepIndex &&
    current.variantId === next.variantId &&
    current.viewport === next.viewport
  );
}

function disposeSession(
  registry: ShellFrameRegistry,
  session: ActiveSession,
  active: RefObject<ActiveSession | undefined>,
): void {
  if (active.current === session) active.current = undefined;
  runFrameCleanup([
    () => session.rejectReady(new FrameError("disposed")),
    () => session.controller.abort(),
    () => session.unsubscribe?.(),
    () => session.mounted?.dispose(),
    () => cancelFrameMount(session.element),
    () => registry.remove(session),
  ]);
}
