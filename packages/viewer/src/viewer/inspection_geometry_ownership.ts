/** Public inspection ownership over the registry's shared geometry scheduler. */

import type {
  ShellFrameRegistry,
  ShellFrameSession,
} from "../shell/frame_registry.js";

/** Supersede only geometry generations previously claimed by the public view. */
export class ViewerInspectionGeometryOwnership {
  private sessions: readonly ShellFrameSession[] = [];

  constructor(private readonly registry: ShellFrameRegistry | undefined) {}

  begin(sessions: readonly ShellFrameSession[]): void {
    this.supersede(false);
    this.sessions = [...new Set(sessions)];
  }

  owns(session: ShellFrameSession): boolean {
    return this.sessions.includes(session);
  }

  clear(): void {
    this.supersede(true);
    this.sessions = [];
  }

  private supersede(refresh: boolean): void {
    if (!this.registry || !this.sessions.length) return;
    this.registry.geometry.supersede(this.sessions);
    if (refresh)
      queueMicrotask(() => {
        void this.registry?.geometry.refresh().catch(() => undefined);
      });
  }
}
