/**
 * Shared unavailable state for a removed entry's previous version, worded by
 * `previews/copy.ts`, which the canvas holds in place of the section.
 * `@mokly/ui/empty-state` draws it.
 */

import { EmptyState } from "@mokly/ui/empty-state";

import { PREVIEW_UNAVAILABLE } from "../previews/copy.js";

/** Render the unavailable copy and, after a failed request, its Retry action. */
export function PreviewUnavailable(props: { retry: (() => void) | undefined }) {
  return (
    <EmptyState
      action={
        props.retry
          ? {
              label: PREVIEW_UNAVAILABLE.retry.label,
              mark: PREVIEW_UNAVAILABLE.retry.attribute,
              onClick: props.retry,
            }
          : undefined
      }
      body={PREVIEW_UNAVAILABLE.body}
      title={PREVIEW_UNAVAILABLE.title}
    />
  );
}
