import { ApiError } from "../../api/errors";
import type {
  Build,
  BuildFailure,
  BuildState,
  Workspace,
  Project,
} from "../../api/types";
import type { PublicationRef } from "../../data/publications";
import type { Resource } from "../../data/use-resource";
import { buildActive } from "../../viewer/build-state";
import type { ClosedPullRequestState } from "../../viewer/resolution";
import { build } from "./build-fixtures";

/**
 * The cases the stage drawing test asks the application about: every project,
 * workspace read and reference the empty stage decides for, and every build
 * a build card shows. A set keyed by an API union fails to compile here when
 * the API adds a value to it.
 */

/** The kind of reference a stage shows: a branch or a pull request. */
export type ReferenceKind = PublicationRef["kind"];

const project: Project = {
  id: "project",
  workspaceId: "workspace",
  workspaceSlug: "workspace",
  name: "Project",
  slug: "project",
  repository: "mokly-ai/project",
  configPath: "mokly.config.json",
  visibility: "private",
  requireApproval: false,
  canAdmin: true,
  publishingAllowed: true,
  automaticBuilds: true,
  buildsAvailable: true,
  canRequestBuilds: true,
  version: 1,
};

const workspace: Workspace = {
  id: "workspace",
  name: "Workspace",
  slug: "workspace",
  role: "owner",
  plan: "team",
  githubInstallationState: "connected",
  version: 1,
};

function failedRead(reason: string): Resource<Workspace> {
  const error = new ApiError({
    code: reason === "not-found" ? "not-found" : "unavailable",
    reason,
    message: "Refused.",
    requestId: "request-" + reason,
    status: reason === "not-found" ? 404 : 503,
  });
  return { status: "error", error };
}

/** The workspace read in every state the role rule tells apart. */
export const reads: Resource<Workspace>[] = [
  { status: "loading" },
  { status: "ready", value: workspace },
  { status: "ready", value: { ...workspace, role: "member" } },
  failedRead("not-found"),
  failedRead("unavailable"),
];

/** Both values of each yes-or-no fact a case varies. */
export const flags = [true, false] as const;

/** Every way a pull request closes, so a way the API adds fails to compile here. */
const closings = {
  closed: true,
  merged: true,
} as const satisfies Record<ClosedPullRequestState, true>;

/**
 * How a reference's row says it closed: a pull request may be open, closed or
 * merged, and a branch never closes.
 */
export function closingsOf(
  kind: ReferenceKind,
): (ClosedPullRequestState | undefined)[] {
  return kind === "pull-request"
    ? [undefined, ...(Object.keys(closings) as ClosedPullRequestState[])]
    : [undefined];
}

/**
 * Whether a reference's row says it comes from a fork: a pull request may, and
 * a branch never does.
 */
export function forksOf(kind: ReferenceKind): boolean[] {
  return kind === "pull-request" ? [false, true] : [false];
}

/** Every project the stage can be asked about, by its four build facts. */
export const projects: Project[] = flags.flatMap((publishingAllowed) =>
  flags.flatMap((buildsAvailable) =>
    flags.flatMap((canRequestBuilds) =>
      flags.map((canAdmin) => ({
        ...project,
        publishingAllowed,
        buildsAvailable,
        canRequestBuilds,
        canAdmin,
      })),
    ),
  ),
);

/** A branch alias, the standalone entry of a project with no branch, a pull request. */
export const references: {
  kind: ReferenceKind;
  reference?: PublicationRef;
}[] = [
  { kind: "branch", reference: { kind: "branch", name: "topic" } },
  { kind: "branch" },
  { kind: "pull-request", reference: { kind: "pull-request", number: 14 } },
];

/** Every build state, so a state the API adds fails to compile here. */
const states = {
  queued: true,
  running: true,
  published: true,
  failed: true,
  "timed-out": true,
  superseded: true,
  cancelled: true,
} as const satisfies Record<BuildState, true>;

/** Every failure cause, so a cause the API adds fails to compile here. */
const causes = {
  exit: true,
  "upload-rejected": true,
  "unsupported-lockfile": true,
  "unsupported-mokly-version": true,
  "uncommitted-changes": true,
  "output-limit": true,
  deadline: true,
  idle: true,
  "plan-required": true,
  infrastructure: true,
  "repository-unavailable": true,
} as const satisfies Record<BuildFailure["cause"], true>;

/**
 * Every build a card can show, as the build lifecycle allows it: a failure
 * cause only on a failed or timed-out build — the deadline and idle limits end
 * a build timed-out, every other cause ends it failed — Cancel offered only
 * while a build is queued or running, and a publication and a newer build
 * named or not.
 */
export function shownBuilds(): Build[] {
  const shown: Build[] = [];
  const all = Object.keys(causes) as BuildFailure["cause"][];
  for (const state of Object.keys(states) as BuildState[]) {
    const ending =
      state === "timed-out"
        ? all.filter((cause) => cause === "deadline" || cause === "idle")
        : state === "failed"
          ? all.filter((cause) => cause !== "deadline" && cause !== "idle")
          : [];
    const failures: (BuildFailure | null)[] =
      ending.length > 0
        ? ending.map((cause) => ({
            step: "install" as const,
            cause,
            exitCode: cause === "exit" ? 1 : null,
          }))
        : [null];
    for (const failure of failures)
      for (const canCancel of buildActive(state) ? flags : [false])
        for (const named of flags)
          shown.push(
            build({
              state,
              failure,
              canCancel,
              publicationId: named ? "publication" : null,
              supersededBy: named ? "newer" : null,
            }),
          );
  }
  return shown;
}
