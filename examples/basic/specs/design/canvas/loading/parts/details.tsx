import { mockLink } from "@mokly/mokly";

import { PropsStatus } from "../../../../../../../packages/ui/src/props-panel/props-panel.js";
import { UsageStatus } from "../../../../../../../packages/ui/src/usage-list/usage-list.js";
import { CONTROLS_COPY } from "../../../components/controls/parts/copy.js";
import type { CanvasDestination } from "../../parts/destinations.js";

/**
 * The route's details while the stage, Props, and Usage wait for them: they
 * load, or a load failed, and Try again opens the artboard that shows them
 * loading again.
 */
export type PendingDetails =
  { status: "loading" } | { status: "failed"; retry: CanvasDestination };

/** The address of Try again after a failed load; a load in flight has none. */
export function retryHref(details: PendingDetails): string | undefined {
  return details.status === "failed" ? mockLink(details.retry) : undefined;
}

/**
 * The shipped Props status until the route's details arrive: the fields wait
 * for the details, which alone carry their declared order. After a failed
 * load, Try again loads the details again.
 */
export function PendingProps({ details }: { details: PendingDetails }) {
  return (
    <PropsStatus
      retryHref={retryHref(details)}
      status={details.status}
      wording={{
        failed: CONTROLS_COPY.loadFailed,
        loading: CONTROLS_COPY.loading,
        retry: CONTROLS_COPY.retry,
      }}
    />
  );
}

/**
 * The shipped Usage status until the route's details arrive, with no count,
 * list, or empty state. After a failed load, Try again loads the details
 * again.
 */
export function PendingUsage({ details }: { details: PendingDetails }) {
  return <UsageStatus retryHref={retryHref(details)} status={details.status} />;
}
