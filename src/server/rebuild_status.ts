/** Parent-owned watched action status and publication boundary. */

import type { RebuildStatus } from "@mokly/viewer/runtime";

import { MoklyError } from "../errors.js";

import { sanitizeRebuildFailure } from "./rebuild_status_detail.js";

/** Version and IPC operations required by the status tracker. */
export interface RebuildStatusPublisher {
  currentUpdateVersion(): number;
  publishRebuildStatus(status: RebuildStatus): void;
}

/** Queue/action lifecycle consumed by watched Serve orchestration. */
export interface WatchRebuildStatus {
  setUpdating(updating: boolean): void;
  sourceFailed(error: unknown): void;
  sourceSucceeded(updateVersion: number): void;
  snapshot(): RebuildStatus;
}

/** Track complete immutable snapshots independently of supervised children. */
export class WatchedRebuildStatus implements WatchRebuildStatus {
  private current: RebuildStatus;

  constructor(
    private readonly publisher: RebuildStatusPublisher,
    private readonly repoRoot: () => string,
  ) {
    this.current = {
      failure: null,
      sequence: 1,
      updateVersion: publisher.currentUpdateVersion(),
      updating: false,
    };
    publisher.publishRebuildStatus(this.current);
  }

  setUpdating(updating: boolean): void {
    if (this.current.updating === updating) return;
    this.publish({
      failure: this.current.failure,
      updateVersion: this.publisher.currentUpdateVersion(),
      updating,
    });
  }

  sourceFailed(error: unknown): void {
    const sequence = this.nextSequence();
    this.install({
      failure: {
        detail: sanitizeRebuildFailure(error, this.repoRoot()),
        id: sequence,
      },
      sequence,
      updateVersion: this.publisher.currentUpdateVersion(),
      updating: this.current.updating,
    });
  }

  sourceSucceeded(updateVersion: number): void {
    this.publish({
      failure: null,
      updateVersion,
      updating: this.current.updating,
    });
  }

  snapshot(): RebuildStatus {
    return this.current;
  }

  private publish(
    value: Pick<RebuildStatus, "failure" | "updateVersion" | "updating">,
  ): void {
    this.install({ ...value, sequence: this.nextSequence() });
  }

  private install(status: RebuildStatus): void {
    this.current = status;
    this.publisher.publishRebuildStatus(status);
  }

  private nextSequence(): number {
    if (this.current.sequence === Number.MAX_SAFE_INTEGER)
      throw new MoklyError(
        "server-failed",
        "watched rebuild status sequence exhausted",
      );
    return this.current.sequence + 1;
  }
}
