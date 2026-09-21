/** One cancellable inspection owner shared by a React shell root. */

import { FrameError } from "../client/frame_error.js";
import { InspectionWork } from "../viewer/inspection_work.js";
import type { InstanceRef } from "../viewer/types.js";

import type {
  ShellHighlightActivation,
  ShellInspectionClaim,
  ShellInspectionKind,
  ShellInspectionSnapshot,
} from "./frame_inspection_types.js";
import {
  captureFrame,
  currentFrameCapture,
  frameEntryKeys,
  frameTargetKeys,
  matchFrameInstances,
  validFrameUsage,
} from "./frame_instances.js";
import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "./frame_registry.js";

interface InspectionOperation {
  readonly cancellation: AbortController;
  readonly id: number;
}

interface PickActivation {
  readonly claim: ShellInspectionClaim;
  readonly promise: Promise<void>;
}

type InspectionListener = () => void;

const SERVER_SNAPSHOT: ShellInspectionSnapshot = { revision: 0 };

/** Coordinate toolbar and public-handle inspection over the same sessions. */
export class ShellInspectionController {
  private readonly listeners = new Set<InspectionListener>();
  private operation: InspectionOperation = {
    cancellation: new AbortController(),
    id: 0,
  };
  private pick: PickActivation | undefined;
  private sequence = 0;
  private snapshot: ShellInspectionSnapshot = SERVER_SNAPSHOT;

  constructor(private readonly registry: ShellFrameRegistry) {}

  getSnapshot = (): ShellInspectionSnapshot => this.snapshot;
  getServerSnapshot = (): ShellInspectionSnapshot => SERVER_SNAPSHOT;

  subscribe = (listener: InspectionListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  subscribeEvents(
    listener: Parameters<ShellFrameRegistry["subscribeEvents"]>[0],
  ): () => void {
    return this.registry.subscribeEvents(listener);
  }

  sessions(): readonly ShellFrameSession[] {
    return this.registry.values();
  }

  visibleSessions(): readonly ShellFrameSession[] {
    return this.registry
      .values()
      .filter(
        (session) =>
          session.element.isConnected &&
          session.element.getClientRects().length > 0,
      );
  }

  claim(kind: ShellInspectionKind): ShellInspectionClaim {
    const operation = this.replaceOperation();
    const claim = { id: operation.id, kind };
    this.publish({ revision: this.snapshot.revision + 1, active: claim });
    return claim;
  }

  current(claim: ShellInspectionClaim): boolean {
    return (
      !this.operation.cancellation.signal.aborted &&
      this.operation.id === claim.id &&
      this.snapshot.active?.id === claim.id
    );
  }

  run<T>(
    claim: ShellInspectionClaim,
    action: (current: () => boolean) => Promise<T>,
  ): Promise<T> {
    const operation = this.operation;
    const current = () => operation === this.operation && this.current(claim);
    const work = new InspectionWork(operation.cancellation.signal, current);
    return work.run(() => action(work.current));
  }

  release(claim: ShellInspectionClaim): void {
    if (!this.current(claim)) return;
    void this.clearClaim(claim).catch(() => undefined);
  }

  cancelPick(): void {
    const claim = this.snapshot.active;
    if (claim?.kind !== "pick") return;
    if (this.pick?.claim.id === claim.id) this.pick = undefined;
    this.release(claim);
  }

  async highlightInstances(
    instances: readonly InstanceRef[],
    scope: readonly ShellFrameSession[] = this.visibleSessions(),
  ): Promise<ShellHighlightActivation | undefined> {
    if (!instances.length) {
      await this.clearPresentation();
      return;
    }
    const targets = matchFrameInstances(scope, instances);
    const sessions = [...new Set(targets.map(({ session }) => session))];
    const captures = targets.map(({ session }) => captureFrame(session));
    const claim = this.claim("highlight");
    let mutating = false;
    try {
      await this.run(claim, async (current) => {
        const ready = await Promise.all(
          captures.map(({ session }) => session.ready),
        );
        if (
          !current() ||
          captures.some(
            (capture) =>
              !currentFrameCapture(this.registry, capture) ||
              capture.session.status !== "ready" ||
              !validFrameUsage(capture.session),
          )
        )
          throw new FrameError("missing-instance");
        const keys = frameTargetKeys(targets);
        const mounted = new Map(
          captures.map((capture, index) => [capture.session, ready[index]!]),
        );
        for (const session of this.registry.values()) {
          if (!keys.has(session))
            ignoreFrameOperation(() => session.mounted?.highlight([], "off"));
        }
        mutating = true;
        await Promise.all(
          [...keys].map(([session, sessionKeys]) =>
            mounted.get(session)!.highlight([...sessionKeys], "highlight"),
          ),
        );
      });
    } catch (error) {
      if (this.current(claim)) {
        if (mutating) void this.clearClaim(claim).catch(() => undefined);
        else this.abandon(claim);
      }
      throw error;
    }
    return { claim, sessions };
  }

  async highlightInstance(
    instance: InstanceRef | null,
    scope: readonly ShellFrameSession[] = this.visibleSessions(),
  ): Promise<void> {
    await this.highlightInstances(instance ? [instance] : [], scope);
  }

  async scrollToInstance(
    instance: InstanceRef,
    scope: readonly ShellFrameSession[] = this.visibleSessions(),
  ): Promise<void> {
    const target = matchFrameInstances(scope, [instance])[0]!;
    const capture = captureFrame(target.session);
    const operation = this.operation;
    const work = new InspectionWork(
      operation.cancellation.signal,
      () => operation === this.operation,
    );
    await work.run(async () => {
      const mounted = await target.session.ready;
      work.check();
      if (!currentFrameCapture(this.registry, capture))
        throw new FrameError("disposed");
      await mounted.scrollTo(target.key);
    });
  }

  startPick(scope: readonly ShellFrameSession[]): Promise<void> {
    const active = this.pick;
    if (active && this.current(active.claim)) return active.promise;
    if (this.snapshot.active?.kind === "pick") return Promise.resolve();
    const captures = scope.map(captureFrame);
    const claim = this.claim("pick");
    const activation = this.run(claim, async (current) => {
      const ready = await Promise.all(
        captures.map(({ session }) => session.ready),
      );
      if (
        !current() ||
        !captures.length ||
        captures.some(
          (capture) =>
            !currentFrameCapture(this.registry, capture) ||
            capture.session.status !== "ready" ||
            !validFrameUsage(capture.session) ||
            !frameEntryKeys(capture.session).length,
        )
      )
        throw new FrameError("unavailable");
      const selected = new Set(scope);
      for (const session of this.registry.values()) {
        if (!selected.has(session))
          ignoreFrameOperation(() => session.mounted?.highlight([], "off"));
      }
      await Promise.all(
        scope.map((session, index) =>
          ready[index]!.highlight(frameEntryKeys(session), "pick"),
        ),
      );
    }).catch((error: unknown) => {
      if (this.current(claim))
        void this.clearClaim(claim).catch(() => undefined);
      throw error;
    });
    const pick = { claim, promise: activation };
    this.pick = pick;
    const settled = () => {
      if (this.pick === pick) this.pick = undefined;
    };
    void activation.then(settled, settled);
    return activation;
  }

  private abandon(claim: ShellInspectionClaim): void {
    if (!this.current(claim)) return;
    this.replaceOperation();
    this.publish({ revision: this.snapshot.revision + 1 });
  }

  private clearClaim(claim: ShellInspectionClaim): Promise<void> {
    if (!this.current(claim)) return Promise.resolve();
    return this.clearPresentation();
  }

  private clearPresentation(): Promise<void> {
    const operation = this.replaceOperation();
    this.publish({ revision: this.snapshot.revision + 1 });
    const work = new InspectionWork(operation.cancellation.signal, () => {
      return operation === this.operation && !this.snapshot.active;
    });
    return work.run(async () => {
      await Promise.allSettled(
        this.registry
          .values()
          .map((session) => session.mounted?.highlight([], "off")),
      );
    });
  }

  private replaceOperation(): InspectionOperation {
    this.operation.cancellation.abort();
    const operation = {
      cancellation: new AbortController(),
      id: ++this.sequence,
    };
    this.operation = operation;
    return operation;
  }

  private publish(snapshot: ShellInspectionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
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
