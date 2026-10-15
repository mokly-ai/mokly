import type { ReactNode } from "react";

import { MetaRow } from "../../../parts/metadata_row.js";
import { actionCompact, ActionPropValues } from "../../parts/action_props.js";

import { CONTROLS_COPY } from "./copy.js";

/** Saved props that the Props tab shows without fields. */
function SavedProps({
  children,
  notice,
  title,
}: {
  children: ReactNode;
  notice: string;
  title: string;
}) {
  return (
    <section className="ce-controls-content">
      <div className="ce-controls-heading">
        <div>
          <h3>{CONTROLS_COPY.readonlyHeading}</h3>
          <p>{title}</p>
        </div>
      </div>
      <p className="ce-controls-notice">{notice}</p>
      {children}
    </section>
  );
}

/** A removed saved variant keeps its saved props readable. */
export function RemovedPanel() {
  return (
    <SavedProps notice={CONTROLS_COPY.removed} title={actionCompact.title}>
      <ActionPropValues props={actionCompact.props} />
    </SavedProps>
  );
}

/** Badge's author declares no controls, so its saved props are read-only. */
export function ReadOnlyPanel() {
  return (
    <SavedProps notice={CONTROLS_COPY.readonlyProps} title="Badge">
      <dl className="ce-props" aria-label="Supplied props">
        <MetaRow name="label" label="label" presentation="props">
          <code>&quot;New&quot;</code>
        </MetaRow>
      </dl>
    </SavedProps>
  );
}

/** An entry without props or registered components has nothing to select. */
export function NoPropsPanel() {
  return <p className="ce-empty-copy">{CONTROLS_COPY.noProps}</p>;
}
