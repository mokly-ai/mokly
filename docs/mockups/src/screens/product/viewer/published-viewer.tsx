import { CanvasDock } from "@mokly/ui/canvas-dock";
import { CatalogueNavigation } from "@mokly/ui/catalogue-navigation";
import { EmbeddedLayout, MarkerLayer } from "@mokly/ui/embedded-layout";
import type { FloatingPanelSheet } from "@mokly/ui/floating-panel";
import { MainRegion } from "@mokly/ui/shell-layout";
import { TopBar } from "@mokly/ui/top-bar";
import "@mokly/ui/styles.css";

import "../../../../styles/product/viewer-depiction.css";
import { staticNoop } from "../../../components/static-controls";
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
import { PublishedWorkspace, shownTab } from "./published-workspace";

/**
 * The catalogue's sheet of the compact layout, which every drawing leaves
 * closed: a phone shows the canvas with its dock, and a wide canvas shows the
 * floating catalogue whatever its sheet's state is.
 */
const closedCatalogue: FloatingPanelSheet = {
  expanded: false,
  onClose: staticNoop,
  onExpandedChange: staticNoop,
  open: false,
};

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
 * `topBarEnd` after its search, the catalogue navigation, which floats over
 * the canvas, the workspace with the sample screen in the phone and browser
 * frames, and the compact layout's dock, which the layout draws over the
 * canvas's bottom, as the app's layout does.
 * Every part draws its controls as pictures or native controls, so the
 * drawing runs no script, and the layout states the document's scheme as its
 * appearance. The top bar takes no end control, because the cloud's bar has
 * no theme toggle, and its search field ends with the package's `⌘K` hint.
 * A phone's bar draws the search's toggle in place of the field.
 *
 * A pull request's drawing opens the right panel on Changes, whose tab holds
 * the cloud's Mokly check in the `changesStart` slot, as the app fills it,
 * and its dock names Changes. A phone keeps the catalogue's and the panel's
 * sheets closed, as every drawing does.
 *
 * A private comparison's message goes in the `stageOverlay` slot, as the app
 * places it. The package reveals that slot by a browser measurement, which a
 * static document never runs, so the workspace also draws the message over
 * the preview pane that the slot would cover.
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
  const tab = subject.check ? "changes" : "inspect";
  return (
    <div className="fo-published-viewer">
      <EmbeddedLayout
        announcement=""
        catalogueSheet={closedCatalogue}
        colorScheme={colorScheme}
        dock={
          <CanvasDock
            interactive={false}
            onCatalogue={staticNoop}
            onFit={staticNoop}
            onTab={staticNoop}
            tab={shownTab(tab)}
          />
        }
        drawerOpen={false}
        emptyStateShown={false}
        interactive={false}
        main={
          <MainRegion id={ids.main}>
            <PublishedWorkspace
              viewport={viewport}
              colorScheme={colorScheme}
              overlay={comparisonBlocked ? <ComparisonOverlay /> : undefined}
              tab={tab}
              {...(subject.check
                ? { changesStart: <ChangesCheck pull={subject.check} /> }
                : {})}
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
          ...(comparisonBlocked
            ? {
                stageOverlay: {
                  content: <ComparisonOverlay />,
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
          />
        )}
      />
    </div>
  );
}
