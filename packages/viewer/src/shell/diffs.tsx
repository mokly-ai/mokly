/** On-demand screen comparison controls inside the catalogue. */

import type { ReactNode } from "react";

import { BrowserFrame, PhoneFrame } from "./frames.js";

/** Keep the live screen available while a requested comparison loads. */
export function DiffScreen(props: {
  children: ReactNode;
  route: string;
  eligible?: boolean;
  component?: boolean;
}) {
  return (
    <section
      className="mbk-diff-screen"
      data-diff-screen={props.route}
      data-diff-component={props.component ? "" : undefined}
    >
      <div className="mbk-diff-toolbar" hidden={props.eligible === false}>
        <span aria-label="Comparison mode" className="mbk-seg" role="group">
          {[
            ["current", "Current"],
            ["side", "Side by side"],
            ["overlay", "Overlay"],
            ["difference", "Difference"],
          ].map(([mode, label]) => (
            <button
              aria-pressed={mode === "current"}
              data-diff-mode={mode}
              key={mode}
              type="button"
            >
              {label}
            </button>
          ))}
        </span>
        <button
          aria-label="Refresh comparison"
          className="mbk-diff-refresh"
          data-diff-refresh=""
          hidden
          title="Refresh comparison"
          type="button"
        >
          <span aria-hidden="true">↻</span>
        </button>
      </div>
      <div className="mbk-current-screen" data-current-screen="">
        {props.children}
      </div>
      <div
        aria-live="polite"
        className="mbk-diff-stage"
        data-diff-stage=""
        hidden
      />
      {!props.component ? (
        <>
          <template data-diff-template="mobile">
            <PhoneFrame />
          </template>
          <template data-diff-template="desktop">
            <BrowserFrame address={props.route} expandable={false} />
          </template>
        </>
      ) : null}
    </section>
  );
}
