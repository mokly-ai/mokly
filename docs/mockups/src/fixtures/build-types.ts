import type { CheckoutHead, OutputEntry } from "./build-output";
import type { buildSteps } from "./builds";

/** A build's lifecycle state, as the build API reports it. */
export type BuildState =
  | "queued"
  | "running"
  | "published"
  | "failed"
  | "timed-out"
  | "superseded"
  | "cancelled";

/** One step of a build. */
export type BuildStep = (typeof buildSteps)[number]["id"];

/** The cause a failed or timed-out build ended with. */
export type BuildCause =
  | "exit"
  | "upload-rejected"
  | "unsupported-lockfile"
  | "unsupported-mokly-version"
  | "uncommitted-changes"
  | "output-limit"
  | "deadline"
  | "idle"
  | "plan-required"
  | "infrastructure"
  | "repository-unavailable";

/** A branch or pull request a build publishes, as its card and chrome name it. */
export type BuildReference =
  | { kind: "branch"; name: string }
  | {
      kind: "pull-request";
      number: string;
      title: string;
      author: string;
      github: string;
    };

/** One build, with what its card and its history row read. */
export interface FixtureBuild {
  reference: BuildReference;
  checkout: CheckoutHead;
  state: BuildState;
  /** The step running, or the step it stopped in; null when none started. */
  step: BuildStep | null;
  cause?: BuildCause;
  /** When it was created, as a history row says it. */
  time: string;
  output: readonly OutputEntry[];
}
