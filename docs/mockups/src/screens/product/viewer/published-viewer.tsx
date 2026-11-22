import { CatalogueNavigation } from "@mokly/ui/catalogue-navigation";
import { EmbeddedLayout, MarkerLayer } from "@mokly/ui/embedded-layout";
import { MainRegion } from "@mokly/ui/shell-layout";
import { TopBar } from "@mokly/ui/top-bar";
import "@mokly/ui/styles.css";

import "../../../../styles/product/viewer-depiction.css";
import { sample } from "../../../fixtures/product";
import { publication } from "../../../fixtures/publications";
import { useMockupRenderContext } from "../../../render-context";

import { defaultReader } from "./account-trigger";
import type { AccountLabel } from "./account-trigger";
import { ChangesCheck } from "./check-panel";
import { readyDetail } from "./pill";
import {
  catalogueFilter,
  catalogueSections,
  catalogueStatus,
} from "./published-navigation";
import type { CatalogueView } from "./published-navigation";
import {
  ComparisonOverlay,
  PublishedSlotCenter,
  PublishedSlotEnd,
  PublishedSlotStart,
} from "./published-slots";
import type { PublishedSubject } from "./published-slots";
import { PublishedWorkspace } from "./published-workspace";
import { SearchHint } from "./search-hint";

const defaultSubject: PublishedSubject = {
  label: publication.branch,
  detail: readyDetail(publication.published),
  sha: publication.sha,
  kind: "branch",
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
 * the embedded layout with the cloud controls in the package top bar's three
 * host slots, `topBarStart` after its mark, `topBarCenter` in its middle and
 * `topBarEnd` after its search, the catalogue navigation, and the workspace
 * with the sample screen in the phone and browser frames.
 * Every part draws its controls as pictures or native controls, so the
 * drawing runs no script, and the layout states the document's scheme as its
 * appearance. The top bar takes no end control, because the cloud's bar has
 * no theme toggle, and its search field ends with the `⌘K` hint.
 *
 * A pull request's desktop drawing fills the `sidePanel` slot with the
 * cloud's Mokly check. A phone draws no side panel, because the package's
 * compact layout has none.
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
  account = defaultReader,
  workspace = sample.workspace,
  project = sample.project,
  comparisonBlocked = false,
  view = "all",
  layered = false,
}: {
  viewport: "mobile" | "desktop";
  subject?: PublishedSubject;
  account?: AccountLabel;
  workspace?: string;
  project?: string;
  comparisonBlocked?: boolean;
  view?: CatalogueView;
  /** Whether a panel or a sheet is open over the viewer. */
  layered?: boolean;
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
          topBarCenter: (
            <PublishedSlotCenter viewport={viewport} subject={subject} />
          ),
          topBarEnd: (
            <PublishedSlotEnd
              viewport={viewport}
              account={account}
              layered={layered}
            />
          ),
          ...(subject.check && viewport === "desktop"
            ? {
                sidePanel: {
                  content: <ChangesCheck pull={subject.check} />,
                  // The panel takes its own width, so the slot keeps none
                  // where the panel hides with the full bar.
                  width: "auto",
                },
              }
            : {}),
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
        topBar={(host) => (
          <TopBar
            drawerOpen={false}
            host={host}
            interactive={false}
            navigationId={ids.navigation}
            searchId={ids.search}
            tagPicker={<SearchHint />}
          />
        )}
      />
    </div>
  );
}
