import { DetailsBody } from "../../../../../packages/ui/src/details-panel/details-panel.js";
import { MetadataCode } from "../../../../../packages/ui/src/metadata-row/metadata-row.js";
import { ExampleDocument } from "../../document.js";
import { COMPONENT_PAGES } from "../components/parts/destinations.js";

import {
  COMPONENT_NAVIGATION,
  componentVariantRows,
} from "./component_nav_data.js";
import { useDesignNavigation } from "./design_navigation.js";
import { DESTINATIONS } from "./destinations.js";
import { DetailsPanel, type CardEvidence } from "./details.js";
import { MetaRow } from "./metadata_row.js";
import type { NavNode } from "./nav.js";
import { DocumentPane, Stage } from "./stage.js";

/** The handbook in its declared folder, beside Welcome and the tour. */
export const PAGE_NODES: readonly NavNode[] = [
  {
    key: "example",
    kind: "folder",
    label: "Example",
    count: 3,
    depth: 0,
    open: true,
  },
  {
    key: "welcome",
    kind: "screen",
    label: "Welcome",
    depth: 1,
    to: DESTINATIONS.welcome,
  },
  {
    key: "tour",
    kind: "flow",
    label: "Example tour",
    depth: 1,
    to: DESTINATIONS.tour,
  },
  {
    key: "handbook",
    kind: "page",
    label: "Getting started",
    depth: 1,
    to: DESTINATIONS.page,
  },
];

/**
 * Changes after one `.action` rule and the handbook's own stylesheet changed.
 * The rule matches Action on its own saved pages, so Action and its variants
 * are changed; it also styles a handbook link, so the handbook has its own
 * row. Variant rows own no artboard in this story and stay depictions.
 */
export const PAGE_STYLE_ROWS: readonly NavNode[] = [
  {
    key: "example",
    kind: "folder",
    label: "Example",
    depth: 0,
    open: true,
  },
  {
    key: "handbook",
    changed: true,
    kind: "page",
    label: "Getting started",
    depth: 1,
    to: DESTINATIONS.stylePage,
  },
  {
    key: "example-components",
    kind: "folder",
    label: "Components",
    depth: 1,
    open: true,
  },
  {
    key: COMPONENT_NAVIGATION.action.id,
    changed: true,
    kind: "component",
    label: COMPONENT_NAVIGATION.action.title,
    depth: 2,
    to: COMPONENT_PAGES["style-changed"],
    variants: "open",
  },
  ...componentVariantRows("action", 3).map(({ to: _to, ...row }) => ({
    ...row,
    changed: true,
  })),
];

/** The page designs' Changes count: the handbook, Action and its variants. */
export const PAGE_STYLE_COUNT = PAGE_STYLE_ROWS.filter(
  (row) => row.kind !== "folder",
).length;

/** The handbook's metadata, followed by its comparison details when given. */
export function PageDetails({
  evidence,
  open = false,
}: {
  evidence?: CardEvidence | undefined;
  open?: boolean;
}) {
  const navigation = useDesignNavigation();
  return (
    <DetailsPanel
      open={open}
      destination={navigation.inspector}
      comparisonEvidence={evidence}
    >
      <DetailsBody description="A handbook to accompany the example screens.">
        <MetaRow name="source" label="Source">
          <MetadataCode>specs/catalogue.tsx</MetadataCode>
        </MetaRow>
        <MetaRow name="tags" label="Tags">
          documents
        </MetaRow>
        <MetaRow name="related-docs" label="Related docs">
          Example notes
        </MetaRow>
      </DetailsBody>
    </DetailsPanel>
  );
}

/** The complete handbook in its bordered pane, linking to the Welcome design. */
export function HandbookStage() {
  return (
    <Stage>
      <DocumentPane>
        <ExampleDocument welcomeId={DESTINATIONS.welcome} />
      </DocumentPane>
    </Stage>
  );
}
