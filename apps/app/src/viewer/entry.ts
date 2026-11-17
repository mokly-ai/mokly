import { useCallback, useEffect, useRef } from "react";

import { asApiError } from "../api/errors";
import type { ApiError } from "../api/errors";
import type { Branch, Publication, PullRequest } from "../api/types";
import {
  everyBranch,
  getPublication,
  listBranches,
  listPullRequests,
  readReferenceRow,
} from "../data/publications";
import type {
  PagedItems,
  PublicationRef,
  ReferenceReads,
} from "../data/publications";
import {
  projectResourceScope,
  useInvalidateResources,
} from "../data/resource-invalidation";
import { isRefreshing, useResource } from "../data/use-resource";
import type { Resource } from "../data/use-resource";
import { useSettled } from "../data/use-settled";

import { referenceStage } from "./reference-stage";
import type { ReferenceRow } from "./reference-stage";
import { standalonePublication } from "./resolution";
import type { ClosedPullRequestState } from "./resolution";

/** What the route resolved the address to, before any URL state is read. */
export type ViewerEntry =
  | { kind: "loading" }
  /** An address that names a reference resolves to one immutable publication. */
  | { kind: "redirect"; publicationId: string }
  /**
   * This reference has nothing ready and no build to show, so the stage offers
   * the way to publish the reference it names. A project with no branch yet
   * names none. A pull request that is closed or merged, or that comes from a
   * fork, gets no new build, so the entry says which and the stage names it.
   */
  | {
      kind: "unpublished";
      reference?: PublicationRef;
      closed: ClosedPullRequestState | undefined;
      fork: boolean;
    }
  | { kind: "publication"; publication: Publication }
  /**
   * One build in the stage: the build address itself, or the build a
   * reference with nothing ready shows while it publishes or after it failed.
   */
  | { kind: "build"; buildId: string; route: boolean }
  /** Expired, deleted or on another project: the switcher is the way back. */
  | { kind: "missing" }
  | { kind: "error"; error: ApiError };

/** What the address named, in the order the resolution table reads it. */
export interface ViewerAddress {
  projectId: string;
  publicationId?: string;
  ref?: PublicationRef;
  /** A build address names one build and no publication. */
  buildId?: string;
  /**
   * Whether the plan lets this project publish. While it does not, the Team
   * card stands for every reference with nothing ready that no running build,
   * closed card or fork card answers for, including an open pull request.
   */
  publishingAllowed: boolean;
}

/**
 * The reads one entry makes. The viewer composes the API's own; a test
 * composes doubles and sees exactly what was read.
 */
export interface EntryReads extends ReferenceReads {
  getPublication: (
    projectId: string,
    publicationId: string,
  ) => Promise<Publication>;
  everyBranch: (projectId: string) => Promise<PagedItems<Branch>>;
}

/** The API's own reads, which every viewer entry makes. */
const apiReads: EntryReads = {
  getPublication,
  everyBranch,
  listBranches,
  listPullRequests,
};

/**
 * The pull request list the route already read for the chrome, once that read
 * has settled: its rows, or nothing when the route read none or its read
 * failed. The entry uses those rows rather than listing them again.
 */
export type RoutePullRequests = () => Promise<
  PagedItems<PullRequest> | undefined
>;

/**
 * A publication the reader cannot open is the same answer as one that never
 * existed, so the address ends at the switcher rather than disclosing which.
 */
function missingOrError(caught: unknown): ViewerEntry {
  const error = asApiError(caught);
  if (
    error &&
    (error.reason === "not-found" || error.reason === "permission-denied")
  ) {
    return { kind: "missing" };
  }
  return error ? { kind: "error", error } : { kind: "missing" };
}

/**
 * The row one reference alias names, from the list that carries its state. A
 * pull request's row comes from the list the route already read, even when
 * that list holds no row for it; the entry lists pull requests itself only
 * when the route has not read them. The route reads no branch list.
 */
async function referenceRow(
  projectId: string,
  ref: PublicationRef,
  reads: EntryReads,
  routePulls: RoutePullRequests,
): Promise<ReferenceRow | undefined> {
  if (ref.kind === "pull-request") {
    const pulls = await routePulls();
    if (pulls !== undefined) {
      return pulls.items.find((pull) => pull.number === ref.number);
    }
  }
  return readReferenceRow(projectId, ref, reads);
}

/**
 * The stage of a reference with no ready publication, in the order
 * `referenceStage` gives it: a build, a failed newest publication's details,
 * or a card, which says how a pull request closed or that it comes from a
 * fork when either holds.
 */
async function withoutReady(
  address: ViewerAddress,
  reference: PublicationRef | undefined,
  row: ReferenceRow | undefined,
  reads: EntryReads,
): Promise<ViewerEntry> {
  const stage = referenceStage(row, address.publishingAllowed);
  if (stage.kind === "build") {
    return { kind: "build", buildId: stage.buildId, route: false };
  }
  if (stage.kind === "failed-publication") {
    const publication = await reads.getPublication(
      address.projectId,
      stage.publicationId,
    );
    return { kind: "publication", publication };
  }
  return {
    kind: "unpublished",
    reference,
    closed: stage.closed,
    fork: stage.fork,
  };
}

/**
 * Turn one viewer address into what the stage shows, through the given reads.
 * Standalone entry follows the project's default branch, a reference follows
 * its own newest ready publication, a publication address opens exactly the
 * publication it names — refreshing it never selects a newer one — and a
 * build address opens its build.
 */
export async function resolveEntry(
  address: ViewerAddress,
  reads: EntryReads,
  routePulls: RoutePullRequests,
): Promise<ViewerEntry> {
  const { projectId, publicationId, ref, buildId } = address;
  if (buildId !== undefined) return { kind: "build", buildId, route: true };
  if (publicationId !== undefined) {
    try {
      const publication = await reads.getPublication(projectId, publicationId);
      return { kind: "publication", publication };
    } catch (caught) {
      return missingOrError(caught);
    }
  }
  if (ref !== undefined) {
    const row = await referenceRow(projectId, ref, reads, routePulls);
    if (row && row.latestPublicationId !== null) {
      return { kind: "redirect", publicationId: row.latestPublicationId };
    }
    return withoutReady(address, ref, row, reads);
  }
  const branches = await reads.everyBranch(projectId);
  const ready = standalonePublication(branches.items);
  if (ready) return { kind: "redirect", publicationId: ready };
  // The default branch is first: with nothing ready anywhere, it is the
  // reference the standalone entry offers to publish.
  const preferred = branches.items[0];
  return withoutReady(
    address,
    preferred ? { kind: "branch", name: preferred.name } : undefined,
    preferred,
    reads,
  );
}

function addressKey(address: ViewerAddress): string {
  const plan = address.publishingAllowed ? "allowed" : "refused";
  if (address.buildId) return "build:" + address.buildId;
  if (address.publicationId) return "publication:" + address.publicationId;
  if (address.ref?.kind === "branch") {
    return plan + "|branch:" + address.ref.name;
  }
  if (address.ref?.kind === "pull-request") {
    return plan + "|pull:" + address.ref.number;
  }
  return plan + "|standalone";
}

/**
 * Resolve one viewer address with the API's reads. `pullRequests` is the pull
 * request list the route read for the chrome, when it read one: the entry
 * waits for that read rather than listing the same rows again.
 */
export function useViewerEntry(
  address: ViewerAddress,
  pullRequests?: Resource<PagedItems<PullRequest>>,
): {
  entry: ViewerEntry;
  reload: () => void;
} {
  const routePulls = useSettled(pullRequests);
  const key = address.projectId + "|" + addressKey(address);
  const resource = useResource(
    () => resolveEntry(address, apiReads, routePulls),
    key,
  );
  const { reload: reloadEntry } = resource;
  const invalidate = useInvalidateResources();
  const latest = useRef({ address, key, pullRequests });
  const pendingReload = useRef<
    { key: string; previous: typeof pullRequests } | undefined
  >(undefined);
  useEffect(() => {
    latest.current = { address, key, pullRequests };
    const pending = pendingReload.current;
    if (!pending) return;
    if (pending.key !== key) {
      pendingReload.current = undefined;
      return;
    }
    // Invalidation renders before the route starts its refresh. Wait for a
    // different settled resource, so that first render cannot reuse the old row.
    if (
      pullRequests === pending.previous ||
      pullRequests?.status === "loading" ||
      isRefreshing(pullRequests)
    ) {
      return;
    }
    pendingReload.current = undefined;
    reloadEntry();
  });
  const reload = useCallback(() => {
    const current = latest.current;
    if (current.address.ref?.kind === "pull-request" && current.pullRequests) {
      pendingReload.current = {
        key: current.key,
        previous: current.pullRequests,
      };
      invalidate([projectResourceScope(current.address.projectId)]);
    } else {
      reloadEntry();
    }
  }, [invalidate, reloadEntry]);
  const entry: ViewerEntry =
    resource.state.status === "loading"
      ? { kind: "loading" }
      : resource.state.status === "error"
        ? { kind: "error", error: resource.state.error }
        : resource.state.value;
  return { entry, reload };
}
