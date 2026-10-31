/**
 * The Usage tab of a component: the screens and components that use it, and
 * the consumers that its change affects. Each row links to one consumer, says
 * whether the use is direct or nested, and counts its instances and views.
 */

import { count } from "../count/count.js";
import { TextButton } from "../text-button/text-button.js";

/** One consumer of the component. */
export interface UsageRow {
  /** The consumer's address, which selects its recorded instance. */
  href: string;
  /** The row's identity, which the row carries in `data-usage-link`. */
  id: string;
  /** The row's stable key: a row keeps its link element while its key stays. */
  key: string;
  /** Whether the consumer uses the component itself, not through another component. */
  direct: boolean;
  /** The number of the consumer's instances of the component. */
  instances: number;
  /** Whether the consumer is removed on the branch. */
  removed: boolean;
  title: string;
  /** The number of the consumer's views that hold an instance. */
  views: number;
}

/** The Usage sections, each with its heading. */
const SECTIONS = {
  "used-by": "Used by",
  affected: "Affected screens and components",
} as const;

function UsageSection({
  rows,
  section,
}: {
  rows: readonly UsageRow[];
  section: keyof typeof SECTIONS;
}) {
  return (
    <section className="mbk-reset" data-usage-section={section}>
      <h3 className="mbk-reset">{SECTIONS[section]}</h3>
      {!rows.length ? (
        <p className="mbk-reset">No recorded consumers.</p>
      ) : (
        <ul className="mbk-usage-list mbk-reset">
          {rows.map((row) => (
            <li className="mbk-reset" data-usage-link={row.id} key={row.key}>
              <a className="mbk-reset" href={row.href}>
                {row.title}
                {row.removed ? " · Removed" : ""}
              </a>
              <small className="mbk-reset">
                {row.direct ? "Direct use" : "Nested use"}
                {` · ${count(row.instances, "instance")} · ${count(row.views, "view")}`}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The consumers that use the component, and, when it has any, the consumers
 * that its change affects.
 */
export function UsageList({
  affected,
  usedBy,
}: {
  affected: readonly UsageRow[];
  usedBy: readonly UsageRow[];
}) {
  return (
    <>
      <UsageSection rows={usedBy} section="used-by" />
      {affected.length ? (
        <UsageSection rows={affected} section="affected" />
      ) : null}
    </>
  );
}

/**
 * The Usage tab while its data loads, after the load failed, with Try again,
 * or while the catalogue has not been checked.
 */
export function UsageStatus({
  onRetry,
  status,
}: {
  /** Receives each press of Try again. */
  onRetry?: (() => void) | undefined;
  status: "failed" | "loading" | "unchecked";
}) {
  if (status === "unchecked")
    return (
      <p className="mbk-reset" data-usage-section="status">
        Usage is unavailable until the catalogue has been checked.
      </p>
    );
  return (
    <section
      aria-label="Usage status"
      className="mbk-reset"
      data-usage-section="status"
    >
      {status === "failed" ? (
        <>
          <p className="mbk-reset" role="alert">
            Usage couldn’t be loaded.
          </p>
          <TextButton onClick={onRetry}>Try again</TextButton>
        </>
      ) : (
        <p className="mbk-reset" role="status">
          Loading usage…
        </p>
      )}
    </section>
  );
}
