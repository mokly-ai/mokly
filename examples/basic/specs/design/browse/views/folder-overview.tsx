import { defineScreen } from "@mokly/mokly";

import { designMetadata } from "../../metadata.js";
import { DESTINATIONS } from "../../parts/destinations.js";
import { DetailsPanel } from "../../parts/details.js";
import { ENTRY_PATHS } from "../../parts/entry_paths.js";
import { MarkdownStage } from "../../parts/markdown.js";
import { MetaRow } from "../../parts/metadata_row.js";
import { NavTree } from "../../parts/nav.js";
import { ScreenHead, Shell, type ArtboardViewport } from "../../parts/shell.js";
import { ExampleReadme } from "../../parts/spec_documents.js";

/** The README's Details, closed until the reader opens the inspector. */
function ReadmeDetails() {
  return (
    <DetailsPanel>
      <div className="mbk-details-body">
        <div>
          <p className="mbk-details-desc">
            What the Example area holds and how its screens are kept.
          </p>
        </div>
        <div className="mbk-meta">
          <MetaRow name="source" label="Source">
            <code className="mbk-code">specs/example/README.md</code>
          </MetaRow>
        </div>
      </div>
    </DetailsPanel>
  );
}

/**
 * A folder's README open as the folder's own page. Its Overview row is current
 * while the folder row above it stays a browse-only row, and the page has no
 * folder crumb of its own because it is the top-level folder's page.
 */
function FolderOverview({ viewport }: { viewport: ArtboardViewport }) {
  return (
    <Shell
      design={DESTINATIONS.exampleOverview}
      viewport={viewport}
      nav={<NavTree activeDestination={DESTINATIONS.exampleOverview} />}
    >
      <ScreenHead
        comparisons={false}
        crumbs={[]}
        path={ENTRY_PATHS.exampleOverview}
        title="Example"
      />
      <MarkdownStage>
        <ExampleReadme />
      </MarkdownStage>
      <ReadmeDetails />
    </Shell>
  );
}

export const folderOverviewScreen = defineScreen({
  ...designMetadata,
  colorSchemes: ["light"],
  description:
    "A folder's README open as the folder's own page, with its Overview row current.",
  desktop: <FolderOverview viewport="desktop" />,
  slug: "folder-overview",
  mobile: <FolderOverview viewport="mobile" />,
  rationale:
    "A folder row only opens and closes the folder, so a folder's own page needs a row of its own. The README is that row, first among the folder's children, and it reads Overview because its title is already the folder's name.",
  title: "Folder overview",
});
