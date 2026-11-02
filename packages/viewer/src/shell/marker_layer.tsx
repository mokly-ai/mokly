import { useSyncExternalStore } from "react";
import type { Ref } from "react";

import {
  MarkerLayer as MarkerLayerView,
  type MarkerRecord,
} from "@mokly/ui/embedded-layout";

import type { ViewerMarker } from "../host/types.js";

import type { MarkerStore } from "./marker_store.js";

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
    <MarkerLayerView
      markers={placements.flatMap((placement): MarkerRecord[] =>
        placement.status === "visible" && placement.rect
          ? [
              {
                content: content.get(placement.id),
                id: placement.id,
                rect: placement.rect,
              },
            ]
          : [],
      )}
      ref={layerRef}
    />
  );
}
