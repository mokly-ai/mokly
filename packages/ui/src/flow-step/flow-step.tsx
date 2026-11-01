/**
 * A user flow: its steps in one scrolling column, each with its number, its
 * title and description, a link to the screen that it shows, and that
 * screen's preview.
 */

import type { ReactNode, Ref } from "react";

/** The stage of a user flow: its steps in one column, which keeps its scroll. */
export function FlowStage({
  children,
  ref,
}: {
  children?: ReactNode;
  /**
   * Receives the column, against which the host measures the frames of the
   * steps, and whose scroll position it keeps.
   */
  ref?: Ref<HTMLDivElement> | undefined;
}) {
  return (
    <div className="mbk-flow mbk-reset" data-mokly-scroll="flow" ref={ref}>
      <div className="flow-track mbk-reset">{children}</div>
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
    <section className="flow-step mbk-reset">
      <div className="flow-step-head mbk-reset">
        <span className="flow-step-num mbk-reset">{number}</span>
        <div className="mbk-reset">
          <h3 className="mbk-reset">{title}</h3>
          <p className="mbk-reset">{description}</p>
          {screen ? (
            <a className="flow-step-link mbk-reset" href={screen.href}>
              This screen in the catalogue: {screen.title} →
            </a>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
