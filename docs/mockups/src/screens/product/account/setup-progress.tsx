/** The three setup steps, named once so every step screen agrees on the order. */
export const setupSteps = ["Workspace", "Install", "Repository"] as const;

/** Which setup step a screen is, counted from one. */
export type SetupStep = 1 | 2 | 3;

/** Every step before this one, which is what a reader on it has usually done. */
function stepsBefore(step: SetupStep): readonly SetupStep[] {
  return ([1, 2, 3] as const).filter((earlier) => earlier < step);
}

/**
 * The progress strip attached to the foot of the account panel. It reports
 * position and what the reader has finished: completed steps take a check, the
 * current step takes an ink chip, and the strip never spends the accent,
 * because the one fill on the screen belongs to the action that moves the user
 * forward. A step the reader passed without doing is not claimed: a workspace
 * that publishes with the CLI reaches the repository step with nothing
 * installed. Below the breakpoint the three labelled columns cannot hold their
 * words, so the strip becomes the current step's name, its position, and a
 * three-segment track that fills as steps complete.
 */
export function SetupProgress({
  step,
  complete = stepsBefore(step),
}: {
  step: SetupStep;
  complete?: readonly SetupStep[];
}) {
  const done = (index: number) =>
    complete.includes((index + 1) as SetupStep) || undefined;
  return (
    <div className="fo-account-progress">
      <div className="fo-step-count">
        <p className="fo-step-count-label">
          <strong>{setupSteps[step - 1]}</strong>
          <span>
            Step {step} of {setupSteps.length}
          </span>
        </p>
        <div className="fo-step-track" aria-hidden="true">
          {setupSteps.map((label, index) => (
            <span
              key={label}
              aria-current={index + 1 === step ? "step" : undefined}
              data-complete={done(index)}
            />
          ))}
        </div>
      </div>
      <ol className="fo-steps" aria-label="Setup progress">
        {setupSteps.map((label, index) => (
          <li
            key={label}
            aria-current={index + 1 === step ? "step" : undefined}
            data-complete={done(index)}
          >
            <span className="fo-step-number" aria-hidden="true">
              {done(index) ? "✓" : index + 1}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
