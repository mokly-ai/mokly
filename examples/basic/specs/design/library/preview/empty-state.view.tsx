import { mockLink } from "@mokly/mokly";

import { EmptyState } from "../../../../../../packages/ui/src/empty-state/empty-state.js";

import type { EmptyStateProps } from "./empty-state.js";

/**
 * The shipped quiet state of a stage. A loading state is busy and announces
 * its body as a status. The action links to the artboard of its outcome. A
 * static artboard runs no script, so an action without a destination is a
 * picture of itself.
 */
export function EmptyStateView({
  actionLabel,
  body,
  busy,
  code,
  destination,
  title,
}: EmptyStateProps) {
  return (
    <EmptyState
      action={
        actionLabel === undefined || actionLabel === ""
          ? undefined
          : destination === undefined
            ? { label: actionLabel }
            : { href: mockLink(destination), label: actionLabel }
      }
      body={body || undefined}
      busy={busy ?? false}
      code={code || undefined}
      interactive={false}
      title={title || undefined}
    />
  );
}
