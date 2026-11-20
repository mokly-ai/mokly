import type { ApiError } from "../api/errors";
import type { Workspace } from "../api/types";
import type { Resource } from "../data/use-resource";

/**
 * Whether the reader owns the project's workspace, which decides who may
 * open Billing. The empty stage's plan card and a build card's plan refusal
 * both read it here, as the workspace-role rule of `viewer-chrome.md`
 * defines it, so the two can never disagree about who is an owner.
 */
export type WorkspaceRole =
  /** The read has not answered, so nothing owner-specific is said yet. */
  | { kind: "pending" }
  | { kind: "owner" }
  /** Any other role, or a `not-found` read: this reader is not an owner. */
  | { kind: "not-owner" }
  /**
   * Any other failure. The card gives way to the workspace's own Try
   * again, because a reader whose role is unknown may be an owner, and an
   * owner is never told to ask an owner.
   */
  | { kind: "unreadable"; error: ApiError };

/** Read the workspace-role rule from one workspace read. */
export function workspaceRole(workspace: Resource<Workspace>): WorkspaceRole {
  if (workspace.status === "loading") return { kind: "pending" };
  if (workspace.status === "error") {
    return workspace.error.reason === "not-found"
      ? { kind: "not-owner" }
      : { kind: "unreadable", error: workspace.error };
  }
  return workspace.value.role === "owner"
    ? { kind: "owner" }
    : { kind: "not-owner" };
}
