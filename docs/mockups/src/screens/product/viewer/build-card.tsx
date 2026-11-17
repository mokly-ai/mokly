import type { ReactNode } from "react";

import { StatusDot } from "../../../entries/design/status-dot.mockup";
import { causeSentence, elisionText } from "../../../fixtures/build-copy";
import type { BuildStep, FixtureBuild } from "../../../fixtures/builds";
import { buildSteps, shortSha } from "../../../fixtures/builds";
import { billing } from "../../../fixtures/product-states";
import { Icon } from "../icons";

/**
 * What a card's body knows about its reader: whether the project lets them
 * request builds, whether they may cancel one, and their role in the
 * workspace, which decides the plan refusal's owner or non-owner body.
 * `pending` is the workspace read still running, so the card says neither.
 */
export interface BuildReader {
  canRequestBuilds: boolean;
  canCancel: boolean;
  role: "owner" | "not-owner" | "pending";
}

/** Cal, an owner who can request and cancel builds, who reads most drawings. */
export const ownerReader: BuildReader = {
  canRequestBuilds: true,
  canCancel: true,
  role: "owner",
};

/** How far one step got, in the word its column says beneath its name. */
type StepState = "done" | "running" | "waiting" | "failed" | "stopped" | "idle";

const stepWords: Record<StepState, string> = {
  done: "Done",
  running: "Running",
  waiting: "Waiting",
  failed: "Failed",
  stopped: "Stopped",
  idle: "Not run",
};

const stepTones = {
  done: "success",
  running: "warning",
  waiting: "neutral",
  failed: "danger",
  stopped: "neutral",
  idle: "neutral",
} as const satisfies Record<
  StepState,
  "neutral" | "success" | "warning" | "danger"
>;

/**
 * Where each step stands. The steps before the build's own step are done; that
 * step runs, failed or stopped with the build; the steps after it wait while
 * the build is active and are not run once it ends.
 */
function stepState(build: FixtureBuild, step: BuildStep): StepState {
  if (build.state === "published") return "done";
  const active = build.state === "queued" || build.state === "running";
  const at = buildSteps.findIndex(({ id }) => id === build.step);
  const index = buildSteps.findIndex(({ id }) => id === step);
  if (at < 0 || index > at) return active ? "waiting" : "idle";
  if (index < at) return "done";
  if (active) return "running";
  return build.state === "failed" || build.state === "timed-out"
    ? "failed"
    : "stopped";
}

/** The reference the build publishes, as its title calls it. */
function referenceNoun(build: FixtureBuild): string {
  return build.reference.kind === "branch"
    ? "this branch"
    : "this pull request";
}

/** The card's title, one per build state, as the viewer builds contract writes it. */
function buildTitle(build: FixtureBuild): string {
  const noun = referenceNoun(build);
  if (build.cause === "plan-required")
    return "Publishing to private projects is on Team";
  switch (build.state) {
    case "queued":
    case "running":
      return "Publishing " + noun;
    case "published":
      return "Published " + noun;
    case "failed":
    case "timed-out":
      return "Unable to publish " + noun;
    case "superseded":
      return "A newer push replaced this build";
    case "cancelled":
      return "Publishing was cancelled";
  }
}

/** A sentence whose backticked words are code, as the contract writes them. */
function Sentence({ text }: { text: string }) {
  return (
    <>
      {text
        .split("`")
        .map((part, index) =>
          index % 2 === 1 ? <code key={index}>{part}</code> : part,
        )}
    </>
  );
}

/**
 * The line under the title: why it failed, or that it waits to start. A plan
 * refusal tells everyone but an owner who can upgrade, and says nothing while
 * the workspace read decides which of them the reader is.
 */
function buildLine(
  build: FixtureBuild,
  reader: BuildReader,
): string | undefined {
  if (build.state === "queued") return "Waiting to start.";
  if (build.cause === "plan-required")
    return reader.role === "not-owner" ? billing.copy.askOwner : undefined;
  return causeSentence(build);
}

function BuildSteps({ build }: { build: FixtureBuild }) {
  return (
    <ol className="fo-build-steps" aria-label="Steps">
      {buildSteps.map((step) => {
        const state = stepState(build, step.id);
        return (
          <li
            className="fo-build-step"
            key={step.id}
            aria-current={
              state === "running" || state === "failed" || state === "stopped"
                ? "step"
                : undefined
            }
          >
            <StatusDot
              moklyInstance={"build-step-" + step.id}
              tone={stepTones[state]}
            />
            <span className="fo-build-step-name">{step.name}</span>
            <span className="fo-build-step-state">{stepWords[state]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The output window: the runner's command and result lines quiet, the
 * process's own output in ink, and one line where the log dropped bytes. It
 * holds the newest line in view and scrolls back from it. The box is a region
 * named by its Output label that a keyboard reader can focus and scroll, as
 * the application's is.
 */
function BuildOutput({ build }: { build: FixtureBuild }) {
  if (build.output.length === 0) return null;
  return (
    <section className="fo-build-output">
      <h3 className="fo-group-label" id="build-output">
        Output
      </h3>
      <div
        className="fo-build-log"
        role="region"
        aria-labelledby="build-output"
        tabIndex={0}
      >
        <pre className="fo-build-lines">
          {build.output.map((entry, index) =>
            "elided" in entry ? (
              <span className="fo-build-elision" key={index}>
                {elisionText(entry.elided)}
              </span>
            ) : (
              <span className={"fo-build-" + entry.stream} key={index}>
                {entry.text}
              </span>
            ),
          )}
        </pre>
      </div>
    </section>
  );
}

/**
 * One build in the stage: its state as the title, the reference it publishes
 * with the commit, the three steps and the output, with at most one action.
 * A failure announces its title and line, because the reader may be watching
 * it happen. The reference and the action stay outside that alert, so a
 * control that changes its label or reports a refusal never repeats it; the
 * reference follows the message in reading order, and the head's grid sets it
 * between the title and the line on screen. The title takes focus after
 * Cancel, so it is a focus target out of the tab order, as in the application.
 */
export function BuildCard({
  build,
  action,
  reader = ownerReader,
}: {
  build: FixtureBuild;
  action?: ReactNode;
  reader?: BuildReader;
}) {
  const reference = build.reference;
  const failed = build.state === "failed" || build.state === "timed-out";
  const line = buildLine(build, reader);
  return (
    <section className="fo-build" aria-labelledby="build-title">
      <div className="fo-build-head">
        <div className="fo-build-summary">
          <div className="fo-build-message" role={failed ? "alert" : undefined}>
            <h2 className="fo-state-title" id="build-title" tabIndex={-1}>
              {buildTitle(build)}
            </h2>
            {line && (
              <p className="fo-build-line">
                <Sentence text={line} />
              </p>
            )}
          </div>
          <p className="fo-build-reference">
            <Icon
              name={reference.kind === "branch" ? "branch" : "pullRequest"}
              size={13}
            />
            <span className="fo-build-reference-name">
              {reference.kind === "branch"
                ? reference.name
                : reference.number + " " + reference.title}
            </span>
            <code className="mono-value">{shortSha(build)}</code>
          </p>
        </div>
        {action && <div className="fo-build-action">{action}</div>}
      </div>
      <BuildSteps build={build} />
      <BuildOutput build={build} />
    </section>
  );
}
