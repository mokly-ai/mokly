import { CatalogueNavigation } from "@mokly/ui/catalogue-navigation";
import { EmbeddedLayout, MarkerLayer } from "@mokly/ui/embedded-layout";
import { MainRegion } from "@mokly/ui/shell-layout";
import { TopBar } from "@mokly/ui/top-bar";
import "@mokly/ui/styles.css";

import "../../../../styles/product/viewer-depiction.css";
import { publication } from "../../../fixtures/publications";
import { sample } from "../../../fixtures/product";
import { useMockupRenderContext } from "../../../render-context";
import {
  catalogueFilter,
  catalogueSections,
  catalogueStatus,
} from "./published-navigation";
import type { CatalogueView } from "./published-navigation";
import {
  ComparisonOverlay,
  PublishedSlotEnd,
  PublishedSlotStart,
} from "./published-slots";
import type {
  PublishedAccountLabel,
  PublishedSubject,
} from "./published-slots";
import { PublishedWorkspace } from "./published-workspace";

const defaultSubject: PublishedSubject = {
  label: publication.branch,
  detail: publication.published,
  sha: publication.sha,
};

/** The ids of the one embedded viewer a drawing holds, unique in its document. */
const ids = {
  main: "mkc-viewer-main",
  navigation: "mkc-viewer-nav",
  search: "mkc-viewer-search",
  status: "mkc-viewer-status",
} as const;

/**
 * The ready publication as a static depiction composed of `@mokly/ui` parts:
 * the embedded layout with the cloud controls in its `topBarStart` and
 * `topBarEnd` slots around the package top bar, the catalogue navigation,
 * and the workspace with the sample screen in the phone and browser frames.
 * Every part draws its controls as pictures or native controls, so the
 * drawing runs no script, and the layout states the document's scheme as its
 * appearance.
 *
 * A private comparison's message goes in the `stageOverlay` slot, as the app
 * places it. The package reveals that slot by a browser measurement, which a
 * static document never runs, so the workspace also draws the message over
 * the preview pane that the slot would cover. Each placement draws its own
 * message, so that its action keeps its own instance key.
 */
export function PublishedViewer({
  viewport,
  subject = defaultSubject,
  account = { label: sample.viewer.name },
  workspace = sample.workspace,
  project = sample.project,
  comparisonBlocked = false,
  view = "all",
}: {
  viewport: "mobile" | "desktop";
  subject?: PublishedSubject;
  account?: PublishedAccountLabel;
  workspace?: string;
  project?: string;
  comparisonBlocked?: boolean;
  view?: CatalogueView;
}) {
  const { colorScheme } = useMockupRenderContext();
  return (
    <div className="fo-published-viewer">
      <EmbeddedLayout
        announcement=""
        colorScheme={colorScheme}
        drawerOpen={false}
        emptyStateShown={false}
        main={
          <MainRegion id={ids.main}>
            <PublishedWorkspace
              viewport={viewport}
              colorScheme={colorScheme}
              overlay={
                comparisonBlocked ? (
                  <ComparisonOverlay instance="viewer-comparison-open-catalogue-preview" />
                ) : undefined
              }
            />
          </MainRegion>
        }
        mainHref={"#" + ids.main}
        markerLayer={<MarkerLayer markers={[]} />}
        navigation={
          <CatalogueNavigation
            busy={false}
            filter={catalogueFilter(view)}
            id={ids.navigation}
            interactive={false}
            maximumWidth={480}
            operable={false}
            resizable={false}
            sections={catalogueSections(view)}
            status={catalogueStatus}
            width={248}
          />
        }
        slots={{
          topBarStart: (
            <PublishedSlotStart
              viewport={viewport}
              subject={subject}
              workspace={workspace}
              project={project}
            />
          ),
          topBarEnd: <PublishedSlotEnd viewport={viewport} account={account} />,
          ...(comparisonBlocked
            ? {
                stageOverlay: {
                  content: (
                    <ComparisonOverlay instance="viewer-comparison-open-catalogue" />
                  ),
                  pointerEvents: "auto",
                },
              }
            : {}),
        }}
        statusId={ids.status}
        theme={colorScheme}
        topBar={
          <TopBar
            drawerOpen={false}
            interactive={false}
            navigationId={ids.navigation}
            searchId={ids.search}
          />
        }
      />
    </div>
  );
}
