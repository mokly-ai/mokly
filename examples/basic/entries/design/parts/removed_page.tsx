import type { ReactNode } from "react";

import { useDesignNavigation } from "./design_navigation.js";
import { DESTINATIONS, type DesignDestination } from "./destinations.js";
import { DetailsPanel } from "./details.js";
import { MetaRow } from "./metadata_row.js";
import { NavTree, type NavNode } from "./nav.js";
import { PreviousVersionLabel } from "./removed_preview.js";
import { ScreenHead, Shell, type ArtboardViewport } from "./shell.js";
import { DocumentPane, Stage } from "./stage.js";

/** One removed document retained by Changes, with the state it opens in. */
interface RemovedDocument {
  description: string;
  design: DesignDestination;
  generated: string;
  id: string;
  title: string;
}

/**
 * The deleted Handbook folder. Changes lists its documents flat, because
 * the folder that held them is no longer in the catalogue.
 */
export const REMOVED_DOCUMENTS = {
  handbook: {
    description: "A handbook to accompany the example screens.",
    design: DESTINATIONS.pageRemoved,
    generated: "handbook.html",
    id: "example-handbook",
    title: "Getting started",
  },
  fieldGuide: {
    description: "The long companion to the handbook, read section by section.",
    design: DESTINATIONS.pageRemovedLong,
    generated: "field-guide.html",
    id: "example-field-guide",
    title: "Field guide",
  },
  printingTips: {
    description: "Notes on printing the example catalogue.",
    design: DESTINATIONS.pageRemovedLoading,
    generated: "printing-tips.html",
    id: "example-printing-tips",
    title: "Printing tips",
  },
  styleNotes: {
    description: "House style for the example writing.",
    design: DESTINATIONS.pageRemovedUnavailable,
    generated: "style-notes.html",
    id: "example-style-notes",
    title: "Style notes",
  },
} as const satisfies Record<string, RemovedDocument>;

const documents = Object.entries(REMOVED_DOCUMENTS);

const removedNodes: readonly NavNode[] = documents.map(([key, entry]) => ({
  depth: 0,
  key,
  kind: "page" as const,
  label: `${entry.title} · Removed`,
  to: entry.design,
}));

function RemovedDetails({ entry }: { entry: RemovedDocument }) {
  const navigation = useDesignNavigation();
  return (
    <DetailsPanel open destination={navigation.inspector}>
      <div className="mbk-details-body">
        <div>
          <p className="mbk-details-desc">{entry.description}</p>
          <p>Location: Example › Handbook</p>
        </div>
        <div className="mbk-meta">
          <MetaRow name="source" label="Source">
            Previous version
          </MetaRow>
          <MetaRow name="generated" label="Generated">
            <code className="mbk-code">{entry.generated}</code>
          </MetaRow>
          <MetaRow name="tags" label="Tags">
            documents
          </MetaRow>
          <MetaRow name="related-docs" label="Related docs">
            Example notes
          </MetaRow>
        </div>
      </div>
    </DetailsPanel>
  );
}

/**
 * A removed document keeps its flat Changes row, its Removed badge, and the
 * baseline path of the folder that was deleted with it. `document`
 * holds the previous version; a state stage replaces it while the previous
 * version is unavailable.
 */
export function RemovedPageScreen({
  document,
  entry,
  state,
  viewport,
}: {
  document?: ReactNode;
  entry: RemovedDocument;
  state?: ReactNode;
  viewport: ArtboardViewport;
}) {
  return (
    <Shell
      design={entry.design}
      viewport={viewport}
      nav={
        <NavTree
          activeDestination={entry.design}
          changedOnly
          changedCount={documents.length}
          nodes={removedNodes}
        />
      }
    >
      <ScreenHead
        comparisons={false}
        crumbs={["Example", "Handbook"]}
        idChip={entry.id}
        status="removed"
        title={entry.title}
      />
      {state ? (
        <Stage>{state}</Stage>
      ) : (
        <>
          <PreviousVersionLabel />
          <Stage>
            <DocumentPane>{document}</DocumentPane>
          </Stage>
        </>
      )}
      <RemovedDetails entry={entry} />
    </Shell>
  );
}
