import type { BuildName } from "./builds";
import { builds, shortSha } from "./builds";
import type { PublicationRecord, PublicationState } from "./publications";
import { history } from "./publications";

/** One history row: a publication, or a build that stands for its own upload. */
export type HistoryEntry =
  | ({ kind: "publication" } & PublicationRecord)
  | {
      kind: "build";
      sha: string;
      state: PublicationState;
      time: string;
      build: BuildName;
    };

function buildEntry(name: "running" | "failed"): HistoryEntry {
  const build = builds[name];
  return {
    kind: "build",
    sha: shortSha(build),
    state: build.state === "running" ? "publishing" : "failed",
    time: build.time,
    build: name,
  };
}

/**
 * The branch's history, newest first: its publications, the build publishing
 * a newer push and the earlier build that failed. The superseded build is not
 * history, and the published build is represented by its publication.
 */
export const referenceHistory: readonly HistoryEntry[] = [
  buildEntry("running"),
  ...history.slice(0, 1).map((entry) => ({
    kind: "publication" as const,
    ...entry,
  })),
  buildEntry("failed"),
  ...history.slice(1).map((entry) => ({
    kind: "publication" as const,
    ...entry,
  })),
];
