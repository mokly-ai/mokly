import type { ReactElement } from "react";

import type { SlotPlacement } from "../authoring/supplied-slots.js";

export const storyInvocation = Symbol("mokly.story-use");

export interface Invocation {
  type: object;
  key: unknown;
  source: unknown;
  slots: readonly SlotPlacement[];
}

export type Props = Record<string, unknown> & {
  [storyInvocation]?: Invocation;
};
export type Element = ReactElement<Props>;
export type CreateElement = (
  type: Element["type"],
  props: Props,
  key?: unknown,
) => Element;

export function invocation(value: unknown): Invocation | undefined {
  return value && typeof value === "object"
    ? (value as Props)[storyInvocation]
    : undefined;
}
