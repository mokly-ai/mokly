import type { BuildSummary, PublicationSummary } from "../api/types";
import type { PublicationRef } from "../data/publications";
import {
  branchPath,
  buildPath,
  publicationPath,
  pullRequestPath,
} from "../navigation/paths";

import { referenceRowState } from "./build-state";
import type { ReferenceRowState } from "./build-state";

/** One reference and the newest attempts its own switcher row carries. */
export interface RefRow {
  ref: PublicationRef;
  title: string;
  author?: string;
  /** The reference's ready publication, if it has one. */
  ready: string | null;
  newest: PublicationSummary | null;
  /** The newest build, for readers with member access; null otherwise. */
  newestBuild: BuildSummary | null;
}

/** What one switcher row says, and where it leads. */
export interface RowTarget {
  state: ReferenceRowState;
  /** The address the row opens. */
  href: string;
}

/**
 * Whether a row is the reference the reader is on: a branch of the same name,
 * or a pull request of the same number. A branch named like a pull request's
 * number is still a branch, so the kind decides first.
 */
export function sameReference(
  row: PublicationRef,
  current: PublicationRef | undefined,
): boolean {
  if (current === undefined) return false;
  return row.kind === "branch"
    ? current.kind === "branch" && current.name === row.name
    : current.kind === "pull-request" && current.number === row.number;
}

/** The reference's own address, which resolves to whatever it shows now. */
function alias(
  row: RefRow,
  workspaceSlug: string,
  projectSlug: string,
): string {
  return row.ref.kind === "branch"
    ? branchPath(workspaceSlug, projectSlug, row.ref.name)
    : pullRequestPath(workspaceSlug, projectSlug, row.ref.number);
}

/**
 * Where one reference's row leads. Its state comes from the newer of its
 * newest publication and newest build. A row with no ready publication whose
 * newest attempt failed opens that attempt's details: a failed build opens its
 * own address and a failed publication its own details. The reference's stage
 * may show another card there — a closed or fork pull request's, or the plan's
 * — so the row never goes through it. Every other row opens the reference,
 * which resolves as before, so a ready publication still wins over a newer
 * build.
 */
export function rowTarget(
  row: RefRow,
  workspaceSlug: string,
  projectSlug: string,
): RowTarget {
  const state = referenceRowState(row.newest, row.newestBuild);
  const failed = row.ready === null && state.state === "failed";
  if (failed && state.fromBuild && row.newestBuild) {
    return {
      state,
      href: buildPath(workspaceSlug, projectSlug, row.newestBuild.id),
    };
  }
  if (failed && !state.fromBuild && row.newest) {
    return {
      state,
      href: publicationPath(workspaceSlug, projectSlug, row.newest.id),
    };
  }
  return {
    state,
    href: alias(row, workspaceSlug, projectSlug),
  };
}
