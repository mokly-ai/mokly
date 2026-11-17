import {
  api,
  correlationHeader,
  expectBody,
  mutationHeaders,
} from "../api/client";
import type { Build, BuildLog, HistoryEntry } from "../api/types";
import type { PublicationRef } from "./publications";

/**
 * How many chunks one log window asks for: the API's maximum. A window that
 * comes back with this many may have more behind it, so the reader asks again.
 */
export const logWindowLimit = 100;

/** The query one reference narrows a history read to. */
function referenceQuery(ref?: PublicationRef): {
  branch?: string;
  pullRequest?: number;
} {
  if (ref?.kind === "branch") return { branch: ref.name };
  if (ref?.kind === "pull-request") return { pullRequest: ref.number };
  return {};
}

/**
 * One reference's publications and builds, newest first. History keeps its
 * own single-page read, as it did before builds joined it.
 */
export async function listHistory(
  projectId: string,
  ref?: PublicationRef,
): Promise<HistoryEntry[]> {
  const page = await expectBody((id) =>
    api.GET("/v1/projects/{projectId}/history", {
      params: { path: { projectId }, query: referenceQuery(ref) },
      headers: correlationHeader(id),
    }),
  );
  return page.items;
}

/** One build of the project; a build the reader may not see is `not-found`. */
export function getBuild(projectId: string, buildId: string): Promise<Build> {
  return expectBody((id) =>
    api.GET("/v1/projects/{projectId}/builds/{buildId}", {
      params: { path: { projectId, buildId } },
      headers: correlationHeader(id),
    }),
  );
}

/** The build's retained log after one sequence, in order. */
export function listBuildLog(
  projectId: string,
  buildId: string,
  after: number,
): Promise<BuildLog> {
  return expectBody((id) =>
    api.GET("/v1/projects/{projectId}/builds/{buildId}/log", {
      params: {
        path: { projectId, buildId },
        query: { after, limit: logWindowLimit },
      },
      headers: correlationHeader(id),
    }),
  );
}

/** Publish the current head of one branch or pull request. */
export function requestBuild(
  projectId: string,
  ref: PublicationRef,
): Promise<Build> {
  return expectBody((id) =>
    api.POST("/v1/projects/{projectId}/builds", {
      params: { path: { projectId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body:
        ref.kind === "branch"
          ? { branch: ref.name }
          : { pullRequest: ref.number },
    }),
  );
}

/** Cancel a queued or running build; a finished build comes back unchanged. */
export function cancelBuild(
  projectId: string,
  buildId: string,
): Promise<Build> {
  return expectBody((id) =>
    api.POST("/v1/projects/{projectId}/builds/{buildId}/cancel", {
      params: { path: { projectId, buildId }, header: mutationHeaders() },
      headers: correlationHeader(id),
    }),
  );
}
