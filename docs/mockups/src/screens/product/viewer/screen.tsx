import type { ReactNode } from "react";

import type { Viewport } from "@mokly/mokly";

import { LayerBeneath } from "../../../components/layer-beneath";
import { Panel } from "../../../entries/design/panel.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import { stateScreenPath } from "../../../fixtures/product-states";
import { Action } from "../page-parts";

import type { AccountLabel } from "./account-trigger";
import { ViewerChrome } from "./chrome";
import type { PublishedSubject } from "./published-slots";

/**
 * Whether a page takes the published path, from its state and the stage body
 * that its fallback path draws. Only the `default` state with an `undefined`
 * body takes it. Any other body, also `false`, takes the fallback path.
 */
export function isPublishedPath(state: ScreenState, body: ReactNode): boolean {
  return state === "default" && body === undefined;
}

/**
 * The two forms of a viewer entry. The published form draws the ready viewer,
 * whose own slots name the publication, so it takes the subject, the view and
 * a blocked comparison of that viewer, and refuses a `publication` and a stage
 * body. The fallback form draws the cloud's bar, which shows the `publication`
 * that it requires, above the stage body, and refuses the ready viewer's props.
 * While the route reads the project, the fallback form takes that read as
 * `waiting` in place of the heading and the stage body.
 */
type ViewerScreenProps = {
  id: string;
  state: ScreenState;
  viewport: Viewport;
  /** Who the bar calls the reader, when it is not Cal. */
  account?: AccountLabel;
  workspace?: string;
  project?: string;
  /** An entry drawing one of the stage's own situations names itself. */
  screen?: string;
} & (
  | {
      published: true;
      heading: string;
      publishedSubject?: PublishedSubject;
      /**
       * A package-reported private comparison failure in its supported slot.
       */
      comparisonBlocked?: boolean;
      view?: "all" | "changes";
      publication?: never;
      children?: never;
      waiting?: never;
    }
  | ({
      published?: false;
      publication: ReactNode;
      publishedSubject?: never;
      comparisonBlocked?: never;
      view?: never;
    } & (
      | { heading: string; children?: ReactNode; waiting?: never }
      /**
       * The project read the route still runs. The whole frame waits for it,
       * and the heading names it, because the heading's own text, the
       * project, is the read's to give. The frame draws the stage's waiting
       * card itself.
       */
      | { waiting: string; heading?: never; children?: never }
    ))
);

/**
 * A viewer entry: the chrome and the stage are the page, so the whole hosted
 * viewer is the document's main landmark and the top bar carries its heading.
 * The caller chooses the form, and a page chooses it with `isPublishedPath`.
 */
export function ViewerScreen({
  id,
  state,
  viewport,
  heading,
  account,
  workspace,
  project,
  screen,
  published,
  publishedSubject,
  comparisonBlocked,
  view,
  publication,
  waiting,
  children,
}: ViewerScreenProps) {
  return (
    <div
      className="folio-root fo-viewer-screen"
      data-mkc-screen={screen ?? stateScreenPath(id, state)}
    >
      {!published && (
        <a className="skip-link" href="#main">
          Skip to content
        </a>
      )}
      {published ? (
        <ViewerChrome
          viewport={viewport}
          heading={heading}
          account={account}
          workspace={workspace}
          project={project}
          published
          publishedSubject={publishedSubject}
          comparisonBlocked={comparisonBlocked}
          view={view}
        />
      ) : (
        <main id="main" className="fo-viewer-main">
          <ViewerChrome
            viewport={viewport}
            heading={heading}
            publication={publication}
            account={account}
            workspace={workspace}
            project={project}
            waiting={waiting}
          >
            {children}
          </ViewerChrome>
        </main>
      )}
    </div>
  );
}

/**
 * A viewer entry with one of its slots open: the panel is the subject, so it
 * takes the document's main landmark and heading and the viewer beneath is
 * inert, exactly as the settings dialog is hosted. The panel owns the
 * screen's one filled action, so the bar's Share beneath it keeps the
 * secondary tone.
 *
 * There is no skip link. Everything before the panel is the inert backdrop, so
 * there is nothing between the start of the document and the main landmark for
 * a reader to skip; the panel is already the first thing they reach.
 */
export function ViewerPanelScreen({
  id,
  state,
  viewport,
  title,
  subtitle,
  close,
  screen,
  children,
}: {
  id: string;
  state: ScreenState;
  viewport: Viewport;
  title: string;
  subtitle?: string;
  close: string;
  /** An entry drawing one of the panel's own situations names itself. */
  screen?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="folio-root fo-viewer-screen"
      data-mkc-screen={screen ?? stateScreenPath(id, state)}
    >
      <LayerBeneath className="fo-viewer-backdrop">
        <ViewerChrome viewport={viewport} published layered />
      </LayerBeneath>
      <div id="main" role="main" className="fo-viewer-surface">
        <Panel
          moklyInstance={"panel-" + id.replaceAll("/", "-")}
          label={title}
          header={
            <>
              <h1 className="fo-viewer-panel-title">{title}</h1>
              {subtitle && (
                <span className="fo-viewer-panel-subtitle">{subtitle}</span>
              )}
            </>
          }
          actions={
            <Action
              instance={id.replaceAll("/", "-") + "-close"}
              label="Close"
              tone="quiet"
              size="sm"
              to={close}
            />
          }
        >
          {children}
        </Panel>
      </div>
    </div>
  );
}
