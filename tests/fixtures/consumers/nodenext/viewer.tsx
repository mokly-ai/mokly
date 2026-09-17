import { createRef } from "react";

import { MoklyViewer, sameOriginAdapter } from "@mokly/viewer";
import type {
  CatalogueReadModel,
  MarkerState,
  MoklyViewerHandle,
  ViewerMarker,
  ViewerSelection,
} from "@mokly/viewer";
import { resolveInstance } from "@mokly/viewer/data";
import { initializeBrowseShell } from "@mokly/viewer/runtime";
import { renderViewer } from "@mokly/viewer/server";

export const runtimeEntry: typeof initializeBrowseShell = initializeBrowseShell;
export const dataEntry: typeof resolveInstance = resolveInstance;

export async function highlightComments(
  handle: MoklyViewerHandle,
  markers: readonly ViewerMarker[],
) {
  await handle.highlightInstances(markers.map(({ instance }) => instance));
}

export function ViewerConsumer({
  catalogue,
  markers,
  onMarkerChange,
  selection,
  onSelectionChange,
}: {
  catalogue: CatalogueReadModel;
  markers: readonly ViewerMarker[];
  onMarkerChange: (states: readonly MarkerState[]) => void;
  selection: ViewerSelection;
  onSelectionChange: (selection: ViewerSelection) => void;
}) {
  const handle = createRef<MoklyViewerHandle>();
  renderViewer({ catalogue, baseUrl: "https://artifact.example", selection });
  return (
    <MoklyViewer
      ref={handle}
      catalogue={catalogue}
      baseUrl="https://artifact.example"
      selection={selection}
      onSelectionChange={onSelectionChange}
      markers={markers}
      onMarkerChange={onMarkerChange}
      frameAdapter={sameOriginAdapter()}
      slots={{
        sidePanel: { content: <p>Discussion</p>, width: 240 },
        stageOverlay: {
          content: <span>Annotation</span>,
          pointerEvents: "none",
        },
      }}
    />
  );
}
