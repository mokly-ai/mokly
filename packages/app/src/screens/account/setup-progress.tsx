/** The three setup steps, named once so every step screen agrees on the order. */
export const setupSteps = ["Workspace", "Install", "Repository"] as const;

/** Which setup step a screen is, counted from one. */
export type SetupStep = 1 | 2 | 3;

/** What the reader has actually done, as the API reports it. */
export interface SetupState {
  workspace?: boolean;
  installed?: boolean;
}

/**
 * The steps this reader has genuinely completed. A step whose state the screen
 * cannot see is not claimed: a check is an assertion about their account, so
 * position alone never earns one.
 */
export function completedSteps(state: SetupState): readonly SetupStep[] {
  const done: SetupStep[] = [];
  if (state.workspace) done.push(1);
  if (state.installed) done.push(2);
  return done;
}

/**
 * The progress strip attached to the foot of the account panel. It reports
 * where the reader is and what they have finished, and never spends the accent,
 * because the one fill on the screen belongs to the action that moves them
 * forward. Below the breakpoint the three labelled columns cannot hold their
 * words, so the strip becomes the current step's name, its position, and a
 * three-segment track.
 */
export function SetupProgress({
  step,
  complete = [],
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
