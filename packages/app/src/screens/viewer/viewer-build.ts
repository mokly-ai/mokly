import { useEffect } from "react";

import type { Build, Project, Session } from "../../api/types";
import { liveClient } from "../../data/live-client";
import { useBuildWatch } from "../../viewer/build-watch";
import type { BuildWatch } from "../../viewer/build-watch";
import type { ViewerEntry } from "../../viewer/entry";

/** The build the stage shows, and what the chrome and panels take from it. */
export interface ViewerBuild {
  watch: BuildWatch;
  /** Repeat a first build read that failed. */
  retry: () => void;
  /** Show the build a write answered with. */
  apply: (build: Build) => void;
  /** The build being shown, for history's current row. */
  buildId?: string;
  /**
   * Whether a build address's build has published, so Share can offer its
   * publication; unknown until the build has been read.
   */
  published?: boolean;
  /** The publication a published build made, which Share offers. */
  publicationId?: string;
}

/**
 * Whether the reader has member access, which builds are shown to. The project
 * read does not name the reader's role, so a reader who can request builds or
 * administers the project has it, and so does every member of the project's
 * workspace; a reviewer with only a direct project grant cannot be told
 * from a reader of a public project.
 */
export function memberAccess(session: Session, project: Project): boolean {
  return (
    project.canRequestBuilds ||
    project.canAdmin ||
    session.workspaceIds.includes(project.workspaceId)
  );
}

/**
 * Follow the build the entry chose. A reference that showed its build while
 * it ran resolves again once that build has published, so the alias lands on
 * the new publication like any alias that gains a ready target; a build
 * address keeps its card, because a terminal transition never navigates.
 */
export function useViewerBuild(
  projectId: string,
  entry: ViewerEntry,
  reload: () => void,
  member: boolean,
): ViewerBuild {
  useEffect(
    () => (member ? liveClient.subscribe(projectId, {}) : undefined),
    [member, projectId],
  );
  const buildId = entry.kind === "build" ? entry.buildId : undefined;
  const { watch, retry, apply } = useBuildWatch(projectId, buildId, member);
  const build = watch.status === "ready" ? watch.build : undefined;
  const route = entry.kind === "build" && entry.route;
  const aliasPublished =
    entry.kind === "build" && !entry.route && build?.state === "published";
  useEffect(() => {
    if (aliasPublished) reload();
  }, [aliasPublished, reload]);
  const published = build
    ? build.state === "published" && build.publicationId !== null
    : watch.status === "missing" || watch.status === "error"
      ? false
      : undefined;
  return {
    watch,
    retry,
    apply,
    buildId,
    published: route ? published : undefined,
    publicationId:
      route && published ? (build?.publicationId ?? undefined) : undefined,
  };
}
