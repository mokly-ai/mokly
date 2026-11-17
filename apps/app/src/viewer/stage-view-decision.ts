import type { ApiError } from "../api/errors";
import type { Build, Workspace, Project } from "../api/types";
import type { PublicationRef } from "../data/publications";
import type { Resource } from "../data/use-resource";
import { workspaceRole } from "./workspace-role";
import type { WorkspaceRole } from "./workspace-role";
import type { ClosedPullRequestState } from "./resolution";

/** The card an unpublished address needs once its project is known. */
export type UnpublishedStage =
  /**
   * An open pull request of a project that cannot build, or that this reader
   * cannot see build: its check publishes it. Only while the plan allows
   * publishing, because a refused plan takes no new publication.
   */
  | { kind: "pull-request" }
  /**
   * A pull request that is closed or merged, with no build still running. It
   * gets no new build, so the card names how it closed and offers the
   * switcher.
   */
  | { kind: "closed-pull-request"; state: ClosedPullRequestState }
  /**
   * An open pull request from a fork. No build runs for it, so the card names
   * the fact, says what the reader can do instead and offers the switcher.
   */
  | { kind: "fork-pull-request" }
  | { kind: "pending-workspace" }
  | { kind: "unreadable-workspace"; error: ApiError }
  | { kind: "plan-required"; canUpgrade: boolean }
  /** A reader who can request a build is offered to publish the reference. */
  | { kind: "publish"; reference: PublicationRef }
  /** A reviewer of a project that can build waits for someone who can. */
  | { kind: "publish-reader"; pullRequest: boolean }
  | { kind: "set-up" };

/** Who reads this address: what decides the build cards a project offers. */
export interface UnpublishedReader {
  /** The reference the card publishes; a project with no branch has none. */
  reference?: PublicationRef;
  /** Whether the reader has member access, which builds are shown to. */
  member: boolean;
  /**
   * How the pull request the address names closed, when it is closed or
   * merged. It gets no new build, so it has a card of its own.
   */
  closed: ClosedPullRequestState | undefined;
  /**
   * Whether the pull request the address names comes from a fork. No build
   * runs for it, so it has a card of its own.
   */
  fork: boolean;
}

/**
 * A reader the address told nothing about: no member access, and no pull
 * request facts.
 */
const unknownReader: UnpublishedReader = {
  member: false,
  closed: undefined,
  fork: false,
};

/**
 * Choose an unpublished card without briefly offering a refused action, in
 * the order `viewer-builds.md` gives it once no build answers for the
 * reference. A closed or merged pull request names how it closed, and then an
 * open one from a fork names that, for every project and plan. The Team card
 * comes next whenever the plan refuses publishing, for a branch and for an
 * open pull request of the project's repository alike, under the
 * workspace-role rule; a project that can build then offers to publish
 * the reference, or says who can; and a project that cannot build keeps Set
 * up publishing, or the waiting card for a pull request.
 */
export function unpublishedStage(
  project: Project,
  workspace: Resource<Workspace>,
  isPullRequest: boolean,
  reader: UnpublishedReader = unknownReader,
): UnpublishedStage {
  if (isPullRequest && reader.closed) {
    return { kind: "closed-pull-request", state: reader.closed };
  }
  if (isPullRequest && reader.fork) return { kind: "fork-pull-request" };
  if (!project.publishingAllowed) {
    const role = workspaceRole(workspace);
    if (role.kind === "pending") return { kind: "pending-workspace" };
    if (role.kind === "unreadable") {
      return { kind: "unreadable-workspace", error: role.error };
    }
    return { kind: "plan-required", canUpgrade: role.kind === "owner" };
  }
  const { reference } = reader;
  if (reference && project.canRequestBuilds) {
    return { kind: "publish", reference };
  }
  if (reference && project.buildsAvailable && reader.member) {
    return { kind: "publish-reader", pullRequest: isPullRequest };
  }
  return isPullRequest ? { kind: "pull-request" } : { kind: "set-up" };
}

/**
 * The workspace read that replaces a build's plan refusal, when it failed.
 * The refusal chooses owner or other copy by the same workspace-role rule
 * as the empty stage, so a read that failed for another reason than
 * `not-found` gives way to that read's own Try again: the reader may be an
 * owner, and an owner is never told to ask an owner.
 */
export function planRefusalFailure(
  build: Build | undefined,
  role: WorkspaceRole,
): ApiError | undefined {
  if (role.kind !== "unreadable") return undefined;
  return build?.failure?.cause === "plan-required" ? role.error : undefined;
}
