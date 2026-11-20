import { useId, useMemo } from "react";

import type { Build } from "../api/types";
import { StateDot } from "../components/controls";

import { buildSteps, stepWords } from "./build-copy";
import { outputLines } from "./build-log";
import type { LogView, OutputLine } from "./build-log";
import { stepProgress, stepTones } from "./build-state";

/** The steps band: Check out, Install and Publish, each with how far it got. */
export function BuildSteps({ build }: { build: Build }) {
  return (
    <ol className="fo-build-steps" aria-label="Steps">
      {buildSteps.map((step) => {
        const progress = stepProgress(build, step.id);
        const current =
          progress === "running" ||
          progress === "failed" ||
          progress === "stopped";
        return (
          <li
            className="fo-build-step"
            key={step.id}
            aria-current={current ? "step" : undefined}
            data-mkc-build-step={step.id}
          >
            <StateDot tone={stepTones[progress]} />
            <span className="fo-build-step-name">{step.name}</span>
            <span className="fo-build-step-state">{stepWords[progress]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** How each kind of line is drawn: Mokly's own lines are quiet. */
const lineClasses: Record<OutputLine["kind"], string | undefined> = {
  ink: undefined,
  system: "fo-build-system",
  elision: "fo-build-elision",
};

/**
 * The output band. The log box opens on its newest line and keeps following it
 * while the reader is at the end; scrolling back stops the following, because
 * a reversed column keeps its place in what the reader is reading. A build
 * with no output yet draws no band at all.
 */
export function BuildOutput({ log }: { log: LogView }) {
  const labelId = useId();
  const lines = useMemo(() => outputLines(log), [log]);
  if (lines.length === 0) return null;
  return (
    <section className="fo-build-output">
      <h3 className="fo-group-label" id={labelId}>
        Output
      </h3>
      <div
        className="fo-build-log"
        role="region"
        aria-labelledby={labelId}
        tabIndex={0}
        data-testid="build-output"
      >
        <pre className="fo-build-lines">
          {lines.map((line, index) => (
            <span className={lineClasses[line.kind]} key={index}>
              {line.text}
            </span>
          ))}
        </pre>
      </div>
    </section>
  );
}
