/** Child-owned staging for update-version-fenced rebuild status snapshots. */

import type { RebuildStatus } from "@mokly/viewer/runtime";

/** Result of offering one validated parent snapshot to the child. */
export type RebuildStatusAcceptance =
  "changed" | "conflict" | "ignored" | "staged";

/** Mutable status boundary paired with the HTTP server's update version. */
export interface ServedRebuildStatus {
  accept(status: RebuildStatus, updateVersion: number): RebuildStatusAcceptance;
  advance(updateVersion: number): RebuildStatus | undefined;
  current(): RebuildStatus;
}

/** Keep one active and at most one newest future-fenced snapshot. */
export class VersionedRebuildStatus implements ServedRebuildStatus {
  private active: RebuildStatus;
  private pending: RebuildStatus | undefined;

  constructor(initial: RebuildStatus, updateVersion: number) {
    if (initial.updateVersion > updateVersion)
      throw new Error(
        "Initial rebuild status is fenced above the server source.",
      );
    this.active = initial;
  }

  accept(
    status: RebuildStatus,
    updateVersion: number,
  ): RebuildStatusAcceptance {
    if (status.sequence === this.active.sequence)
      return sameStatus(status, this.active) ? "ignored" : "conflict";
    if (this.pending && status.sequence === this.pending.sequence)
      return sameStatus(status, this.pending) ? "ignored" : "conflict";
    const newest =
      this.pending && this.pending.sequence > this.active.sequence
        ? this.pending
        : this.active;
    if (status.sequence < newest.sequence) return "ignored";
    if (status.updateVersion > updateVersion) {
      this.pending = status;
      return "staged";
    }
    this.active = status;
    this.pending = undefined;
    return "changed";
  }

  advance(updateVersion: number): RebuildStatus | undefined {
    if (!this.pending || this.pending.updateVersion > updateVersion) return;
    this.active = this.pending;
    this.pending = undefined;
    return this.active;
  }

  current(): RebuildStatus {
    return this.active;
  }
}

function sameStatus(left: RebuildStatus, right: RebuildStatus): boolean {
  return (
    left.sequence === right.sequence &&
    left.updateVersion === right.updateVersion &&
    left.updating === right.updating &&
    left.failure?.detail === right.failure?.detail &&
    left.failure?.id === right.failure?.id
  );
}
