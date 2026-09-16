import { createRef } from "react";

import { MoklyViewer, sameOriginAdapter } from "@mokly/viewer";
import type {
  CatalogueReadModel,
  MoklyViewerHandle,
  ViewerSelection,
} from "@mokly/viewer";
import { resolveInstance } from "@mokly/viewer/data";
import { initializeBrowseShell } from "@mokly/viewer/runtime";
import { renderViewer } from "@mokly/viewer/server";

export const runtimeEntry: typeof initializeBrowseShell = initializeBrowseShell;
export const dataEntry: typeof resolveInstance = resolveInstance;

export function ViewerConsumer({
  catalogue,
  selection,
  onSelectionChange,
}: {
  catalogue: CatalogueReadModel;
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
