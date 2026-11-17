import type {
  Branch,
  Build,
  BuildLogChunk,
  BuildLogElision,
  HistoryEntry,
  Project,
  PullRequest,
} from "../api/types";
import type { ApiDataReason, ApiErrorData } from "../api/error-data";
import type { ApiReason } from "../api/reasons";

/** A refusal, with the data the generated contract gives its reason. */
export type Refusal =
  | {
      [Reason in ApiDataReason]: { reason: Reason; data: ApiErrorData[Reason] };
    }[ApiDataReason]
  | { reason: Exclude<ApiReason, ApiDataReason>; data?: never };

/**
 * The build operations, answered for one project in a run that cannot build.
 *
 * The browser suite starts the real API without GitHub or E2B, so it reports
 * builds unavailable and no build ever exists. This stands in for exactly the
 * reads and writes that would need them — the project's build fields, the
 * reference rows' newest builds, history, the build reads and its log, and the
 * request and cancel writes — with bodies typed by the generated client.
 * Everything else, and every read it does not change, is the real API's.
 * Tests change `builds`, `logs` and the rows between polls, and the card
 * follows on its next read. `build-routes.ts` routes the page's requests to
 * it and `build-answers.ts` answers them.
 */
export interface BuildDouble {
  /** Project fields the reads report over the real answer. */
  project: Partial<Project>;
  builds: Map<string, Build>;
  /** Each build's retained chunks, in order. */
  logs: Map<string, BuildLogChunk[]>;
  elisions: Map<string, BuildLogElision>;
  /** Branch rows answered in place of the real rows of the same name. */
  branches: Branch[];
  pullRequests: PullRequest[];
  /** History answered for every reference, when set. */
  history?: HistoryEntry[];
  /** The bodies `requestBuild` was sent, and the builds `cancelBuild` named. */
  requests: unknown[];
  cancels: string[];
  /** Every build and log read, in order, to see when polling stops. */
  reads: string[];
  /** The next build `requestBuild` creates. */
  nextBuild?: Build;
  refuseRequest?: Refusal;
  refuseCancel?: ApiReason;
  /**
   * Accept full project updates here, as the API would for a project that
   * can build, and record their bodies; otherwise they reach the real API.
   */
  acceptUpdates?: boolean;
  updates: unknown[];
  /** Refuse build reads, or log reads, with this reason while set. */
  failBuild?: ApiReason;
  failLog?: ApiReason;
  /**
   * While set, a build read answers with the build as it was when the read
   * arrived, but only once this settles: a read the card started before a
   * write, answering after the write's own answer.
   */
  holdBuildReads?: Promise<void>;
  /** How many build reads wait on `holdBuildReads` now. */
  heldBuildReads: number;
}

/** A double with nothing in it but the fields a test names. */
export function buildDouble(over: Partial<BuildDouble> = {}): BuildDouble {
  return {
    project: { buildsAvailable: true, canRequestBuilds: true },
    builds: new Map(),
    logs: new Map(),
    elisions: new Map(),
    branches: [],
    pullRequests: [],
    requests: [],
    cancels: [],
    reads: [],
    updates: [],
    heldBuildReads: 0,
    ...over,
  };
}

/** Add output to one build's log, numbered after what it already holds. */
export function write(
  double: BuildDouble,
  buildId: string,
  lines: readonly (Pick<BuildLogChunk, "text"> & Partial<BuildLogChunk>)[],
): void {
  const held = double.logs.get(buildId) ?? [];
  let sequence = held.length > 0 ? held[held.length - 1].sequence : 0;
  const attempt = double.builds.get(buildId)?.attempt ?? 1;
  for (const line of lines) {
    sequence += 1;
    held.push({
      sequence,
      attempt,
      step: "checkout",
      stream: "stdout",
      ...line,
    });
  }
  double.logs.set(buildId, held);
}

/** Change one build the double answers for, as the worker would. */
export function advance(
  double: BuildDouble,
  buildId: string,
  over: Partial<Build>,
): Build {
  const build = double.builds.get(buildId);
  if (!build) throw new Error("[app/tests] no build " + buildId);
  const next = { ...build, ...over };
  double.builds.set(buildId, next);
  return next;
}
