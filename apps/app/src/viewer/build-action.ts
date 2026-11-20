import type { Build, Project } from "../api/types";

import { buildActive } from "./build-state";
import type { WorkspaceRole } from "./workspace-role";

/**
 * The one action a build's card can offer, with what it opens. Every kind has
 * a drawing in the catalogue; the application's drawing test maps each kind
 * to its drawing, so a kind added here without one fails to compile there.
 */
export type BuildAction =
  /** Stop a queued or running build: secondary, it moves on by itself. */
  | { kind: "cancel" }
  /** The build's publication, on Changes when the build had a base. */
  | { kind: "open-catalogue"; publicationId: string; changes: boolean }
  | { kind: "open-newer"; buildId: string }
  /** An owner's way past a plan refusal. */
  | { kind: "open-billing" }
  /** The CI setup guide, for a lockfile builds cannot install. */
  | { kind: "publish-from-ci" }
  | { kind: "try-again" };

/**
 * Choose the card's one action, or none for a reader who has no way on, as the
 * viewer builds contract's state table and its cause rules choose it. A plan
 * refusal offers Billing only to an owner, by the workspace-role rule; a
 * lockfile builds cannot install offers the CI guide, because the same request
 * would fail again; every other ending offers Try again to a reader who can
 * request builds.
 */
export function buildAction(
  build: Build,
  project: Pick<Project, "canRequestBuilds">,
  role: WorkspaceRole,
): BuildAction | undefined {
  if (buildActive(build.state)) {
    return build.canCancel ? { kind: "cancel" } : undefined;
  }
  if (build.state === "published") {
    return build.publicationId
      ? {
          kind: "open-catalogue",
          publicationId: build.publicationId,
          changes: Boolean(build.baseRef),
        }
      : undefined;
  }
  if (build.state === "superseded") {
    return build.supersededBy
      ? { kind: "open-newer", buildId: build.supersededBy }
      : undefined;
  }
  const cause = build.failure?.cause;
  if (cause === "plan-required") {
    return role.kind === "owner" ? { kind: "open-billing" } : undefined;
  }
  if (cause === "unsupported-lockfile") return { kind: "publish-from-ci" };
  return project.canRequestBuilds ? { kind: "try-again" } : undefined;
}

/**
 * Whether the card waits on its action for the workspace read. A plan refusal
 * offers Billing to an owner only, so while the read that says who the reader
 * is runs, the card offers no action and draws the owner's action as a
 * placeholder in its place, as the workspace-role rule of `viewer-chrome.md`
 * asks. A failure is only ever a failed or timed-out build's.
 */
export function awaitsOwnerAction(build: Build, role: WorkspaceRole): boolean {
  return build.failure?.cause === "plan-required" && role.kind === "pending";
}
