/**
 * Shared unavailable state for a removed entry's previous version, worded by
 * `previews/copy.ts`. `@mokly/ui/preview-state` draws it.
 */

import { PreviewUnavailable as PreviewUnavailableView } from "@mokly/ui/preview-state";

import { PREVIEW_UNAVAILABLE } from "../previews/copy.js";

/** Render the unavailable copy and, after a failed request, its Retry action. */
export function PreviewUnavailable(props: { retry: (() => void) | undefined }) {
  return (
    <PreviewUnavailableView
      body={PREVIEW_UNAVAILABLE.body}
      retry={
        props.retry
          ? {
              label: PREVIEW_UNAVAILABLE.retry.label,
              mark: PREVIEW_UNAVAILABLE.retry.attribute,
              onClick: props.retry,
            }
          : undefined
      }
      title={PREVIEW_UNAVAILABLE.title}
    />
  );
}
