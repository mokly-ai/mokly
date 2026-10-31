/**
 * A user flow: its steps in one scrolling column, each with its number, its
 * title and description, a link to the screen that it shows, and that
 * screen's preview.
 */

import type { ReactNode } from "react";

/** The stage of a user flow: its steps in one column, which keeps its scroll. */
export function FlowStage({ children }: { children?: ReactNode }) {
  return (
    <div className="mbk-flow" data-mokly-scroll="flow">
      <div className="flow-track">{children}</div>
    </div>
  );
}

/** The screen that a step shows, in the catalogue. */
export interface FlowStepScreen {
  /** The address of the screen's own page. */
  href: string;
  title: string;
}

/**
 * One step of a user flow. Without a screen, the step has no link and no
 * preview.
 */
export function FlowStep({
  children,
  description,
  number,
  screen,
  title,
}: {
  /** The preview of the step's screen. */
  children?: ReactNode;
  description?: string | undefined;
  /** The step's number, from one. */
  number: number;
  screen?: FlowStepScreen | undefined;
  title: string;
}) {
  return (
    <section className="flow-step">
      <div className="flow-step-head">
        <span className="flow-step-num">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
          {screen ? (
            <a className="flow-step-link" href={screen.href}>
              This screen in the catalogue: {screen.title} →
            </a>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
