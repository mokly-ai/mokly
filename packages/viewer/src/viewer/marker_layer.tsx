import { useSyncExternalStore } from "react";
import type { Ref } from "react";

import type { MarkerStore } from "./marker_store.js";
import type { ViewerMarker } from "./types.js";

interface MarkerLayerProps {
  layerRef?: Ref<HTMLDivElement>;
  markers: readonly ViewerMarker[];
  store: MarkerStore;
}

/** React keeps host content declarative while the runtime supplies placement. */
export function MarkerLayer({ layerRef, markers, store }: MarkerLayerProps) {
  const placements = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const content = new Map(markers.map((marker) => [marker.id, marker.content]));
  return (
    <div data-mokly-marker-layer="" data-mokly-slot="markers" ref={layerRef}>
      {placements.flatMap((placement) =>
        placement.status === "visible" && placement.rect
          ? [
              <div
                data-mokly-marker={placement.id}
                key={placement.id}
                style={{
                  position: "absolute",
                  pointerEvents: "none",
                  ...placement.rect,
                }}
              >
                {content.get(placement.id)}
              </div>,
            ]
          : [],
      )}
    </div>
  );
}
