/**
 * The Props tab's read-only views: the props that a page or a parent supplies
 * to a component instance, with the slots it fills, the line that says why
 * the tab shows no props, and the tab's state while its data loads.
 */

import type { ReactNode } from "react";

import { MetadataRow } from "../metadata-row/metadata-row.js";
import { TextButton } from "../text-button/text-button.js";

/** One supplied prop: its name and its value as text, or a "Not set" line. */
export interface PropValue {
  name: string;
  value: string;
}

/** The one list of supplied props: each name and its value. */
export function PropValues({ values }: { values: readonly PropValue[] }) {
  return (
    <dl aria-label="Supplied props" className="mbk-props">
      {values.map(({ name, value }) => (
        <MetadataRow key={name} label={name} presentation="props">
          <code>{value}</code>
        </MetadataRow>
      ))}
    </dl>
  );
}

/** Supplied slots under their own heading, below the props. Without a slot, nothing renders. */
export function PropSlots({
  slots,
}: {
  slots?: readonly string[] | undefined;
}) {
  return slots?.length ? (
    <>
      <h4>Slots</h4>
      {slots.map((slot) => (
        <p key={slot}>{slot}</p>
      ))}
    </>
  ) : null;
}

/**
 * The line that says why the tab shows no props. While the data that decides
 * it loads, the line is a status.
 */
export function PropsMessage({
  children,
  pending = false,
}: {
  children: ReactNode;
  pending?: boolean | undefined;
}) {
  return (
    <p
      className={pending ? undefined : "mbk-empty-copy"}
      role={pending ? "status" : undefined}
    >
      {children}
    </p>
  );
}

/** A selected component instance: its component's title, its id, and the component's page. */
export interface PropsInstance {
  /** The address of the component's page, when the catalogue has it. */
  href?: string | undefined;
  id: string;
  title: string;
}

/**
 * Supplied props: a selected instance's heading and its link to the
 * component's page, then the props, or a line that it has none, then the
 * slots.
 */
export function PropsPanel({
  instance,
  slots,
  values,
}: {
  instance?: PropsInstance | undefined;
  slots?: readonly string[] | undefined;
  values: readonly PropValue[];
}) {
  return (
    <>
      {instance ? (
        <>
          <h3>
            {instance.title}
            {` · ${instance.id}`}
          </h3>
          {instance.href !== undefined ? (
            <a href={instance.href}>Open component</a>
          ) : null}
        </>
      ) : null}
      {values.length ? (
        <PropValues values={values} />
      ) : (
        <p>No data props supplied.</p>
      )}
      <PropSlots slots={slots} />
    </>
  );
}

/** The wording of the Props tab's loading state, which the host supplies. */
export interface PropsStatusWording {
  failed: string;
  loading: string;
  retry: string;
}

/** The Props tab while its data loads, or after the load failed, with Try again. */
export function PropsStatus({
  onRetry,
  status,
  wording,
}: {
  /** Receives each press of Try again. */
  onRetry?: (() => void) | undefined;
  status: "failed" | "loading";
  wording: PropsStatusWording;
}) {
  return (
    <section aria-label="Props status" data-props-section="status">
      {status === "failed" ? (
        <>
          <p role="alert">{wording.failed}</p>
          <TextButton onClick={onRetry}>{wording.retry}</TextButton>
        </>
      ) : (
        <p role="status">{wording.loading}</p>
      )}
    </section>
  );
}
