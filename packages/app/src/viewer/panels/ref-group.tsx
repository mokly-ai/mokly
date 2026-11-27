import { TextBar } from "../../components/placeholders";

import { PanelList } from "./panel-rows";
import type { PanelRow, WaitingPanelRow } from "./panel-rows";

/**
 * A reference while the switcher's read runs: its state, its name, its time
 * and its head are the read's.
 */
const waitingRef: WaitingPanelRow = {
  id: "waiting",
  waiting: true,
  title: "",
  detail: "",
  status: true,
  sha: true,
};

/**
 * One group of the switcher's references under its label, as the catalogue's
 * `RefGroup` draws it. Only a group with references shows, so while the read
 * runs, `waiting` is the label's width in its own type, as a CSS length: the
 * label is a bar, and one placeholder row stands for the references.
 */
export function RefGroup(
  props: { label: string } & ({ rows: PanelRow[] } | { waiting: string }),
) {
  const waits = "waiting" in props;
  if (!waits && props.rows.length === 0) return null;
  return (
    <section className="fo-ref-group">
      {waits ? (
        <span className="fo-group-label" aria-hidden="true">
          <TextBar width={props.waiting} />
        </span>
      ) : (
        <span className="fo-group-label">{props.label}</span>
      )}
      <PanelList label={props.label} rows={waits ? [waitingRef] : props.rows} />
    </section>
  );
}
