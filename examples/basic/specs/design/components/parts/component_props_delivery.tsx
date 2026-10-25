import { CONTROLS_COPY } from "../controls/parts/copy.js";

/**
 * The Props tab while the entry's detail loads, and after its load failed.
 * Its fields wait for the detail, which alone carries their declared order.
 */
export function PropsDeliveryState({ state }: { state: "loading" | "failed" }) {
  return (
    <section className="ce-props-state" aria-label="Props status">
      {state === "loading" ? (
        <p className="ce-empty-copy" role="status">
          {CONTROLS_COPY.loading}
        </p>
      ) : (
        <>
          <p className="ce-empty-copy" role="alert">
            {CONTROLS_COPY.loadFailed}
          </p>
          <button className="ce-text-button" type="button">
            {CONTROLS_COPY.retry}
          </button>
        </>
      )}
    </section>
  );
}
