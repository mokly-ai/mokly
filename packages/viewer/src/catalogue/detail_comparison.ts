/**
 * The comparison fields of an entry detail: each view's review state and
 * ignore ids, which travel with its evidence, and the base side's address.
 */

import { isKebabCase } from "@mokly/model";
import type { ReviewEntryAddress, ReviewState } from "@mokly/model";

import { invalidData } from "../components/data.js";

import { readProps } from "./component_values.js";
import { array, choice, entryPath, object, string, text } from "./values.js";

const STATES = [
  "unchanged",
  "changed",
  "added",
  "removed",
  "ignored-only",
] as const;

/** A ready view's review state and its sorted unique ignore ids. */
export interface ViewComparison {
  state: ReviewState;
  ignoredIds: string[];
}

/**
 * Read a view's state and ignore ids, which are present exactly when the view
 * carries ready evidence.
 */
export function readViewComparison(
  input: Readonly<Record<string, unknown>>,
  ready: boolean,
): ViewComparison | undefined {
  if (
    (input.state !== undefined) !== ready ||
    (input.ignoredIds !== undefined) !== ready
  )
    invalidData("$detail.view", "state and ignore ids travel with evidence");
  if (!ready) return undefined;
  const ignoredIds = array(input.ignoredIds).map((raw) => {
    const id = string(raw);
    if (!isKebabCase(id)) invalidData("$detail.view", "invalid ignore id");
    return id;
  });
  if (ignoredIds.some((id, index) => index > 0 && ignoredIds[index - 1]! >= id))
    invalidData("$detail.view", "ignore ids are sorted and unique");
  return { state: choice(input.state, STATES), ignoredIds };
}

/** Read the base side's address of a current screen or component. */
export function readBaseAddress(
  value: unknown,
  kind: "screen" | "component",
): ReviewEntryAddress {
  const input = object(value);
  if (kind === "screen" && input.suppliedSlots !== undefined)
    invalidData("$detail.before", "only a component supplies slots");
  return {
    path: entryPath(input.path),
    title: text(input.title),
    ...(input.props === undefined ? {} : { props: readProps(input.props) }),
    ...(input.suppliedSlots === undefined
      ? {}
      : { suppliedSlots: array(input.suppliedSlots).map(string) }),
  };
}
