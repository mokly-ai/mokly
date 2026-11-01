import { PropsStatus } from "../../../../../../packages/ui/src/props-panel/props-panel.js";
import { CONTROLS_COPY } from "../controls/parts/copy.js";

/**
 * The shipped Props tab while the entry's detail loads, and after its load
 * failed. Its fields wait for the detail, which alone carries their declared
 * order.
 */
export function PropsDeliveryState({ state }: { state: "loading" | "failed" }) {
  return (
    <PropsStatus
      status={state}
      wording={{
        failed: CONTROLS_COPY.loadFailed,
        loading: CONTROLS_COPY.loading,
        retry: CONTROLS_COPY.retry,
      }}
    />
  );
}
