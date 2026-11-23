import type { ReactNode } from "react";

import type { Viewport } from "@mokly/mokly";

import "../../../../styles/product/viewer-canvas.css";
import { sample } from "../../../fixtures/product";
import { Pending } from "../page-parts";
import { StatePlaceholder } from "../placeholders";
import { ViewerStage } from "../shell";

import { defaultReader } from "./account-trigger";
import type { AccountLabel } from "./account-trigger";
import { ViewerBar } from "./bar";
import type { PublishedSubject } from "./published-slots";
import { PublishedViewer } from "./published-viewer";
import { StageCard } from "./stage-card";

/**
 * The two forms of the chrome. The published form draws the ready viewer,
 * whose own slots draw the publication trigger, so it refuses a
 * `publication` and a wait. The fallback form draws the cloud's bar, which
 * shows the `publication` that it requires, also while it waits.
 */
type ViewerChromeProps = {
  viewport: Viewport;
  heading?: string;
  /** Who the bar calls the reader, when it is not Cal. */
  account?: AccountLabel;
  workspace?: string;
  project?: string;
  children?: ReactNode;
  publishedSubject?: PublishedSubject;
  comparisonBlocked?: boolean;
  view?: "all" | "changes";
} & (
  | {
      published: true;
      /** Whether a panel or a sheet is open over the viewer. */
      layered?: boolean;
      publication?: never;
      waiting?: never;
    }
  | {
      published?: false;
      layered?: never;
      publication: ReactNode;
      /** The project read the route still runs, which the frame waits for. */
      waiting?: string;
    }
);

/**
 * The hosted viewer with the cloud's chrome in its slots. The heading is the
 * project and its publication, carried by the chrome and visually hidden
 * because the triggers already name both; a screen whose panel owns the
 * document heading passes none. While the route reads the project, `waiting`
 * is that read, and the whole cloud frame is one waiting region: the bar's
 * controls wait over the stage's waiting card. The heading's own text is the
 * read's to give, so the heading holds the read's one name for screen
 * readers, and the card's title, which would repeat it, is a bar.
 *
 * Every viewer drawing renders this chrome, so its module carries the Canvas
 * stylesheet that only the drawings load: the inline end of the bar's two
 * compositions. The stage's dot-grid canvas and its floating cards come
 * through `viewer.css`, which the application loads too.
 */
export function ViewerChrome({
  viewport,
  heading,
  publication,
  account = defaultReader,
  workspace = sample.workspace,
  project = sample.project,
  children,
  published = false,
  layered = false,
  publishedSubject,
  comparisonBlocked = false,
  view = "all",
  waiting,
}: ViewerChromeProps) {
  if (waiting !== undefined)
    return (
      <Pending label={waiting} labelMode="screen-reader-only">
        {(name) => (
          <>
            <h1 className="fo-sr-only">{name}</h1>
            <ViewerStage
              bar={
                <ViewerBar
                  viewport={viewport}
                  publication={publication}
                  account={account}
                  workspace={workspace}
                  project={project}
                  waiting
                />
              }
            >
              <StageCard>
                <StatePlaceholder size="md" />
              </StageCard>
            </ViewerStage>
          </>
        )}
      </Pending>
    );
  return (
    <>
      {heading && <h1 className="fo-sr-only">{heading}</h1>}
      {published ? (
        <PublishedViewer
          viewport={viewport}
          subject={publishedSubject}
          account={account}
          workspace={workspace}
          project={project}
          comparisonBlocked={comparisonBlocked}
          view={view}
          layered={layered}
        />
      ) : (
        <ViewerStage
          bar={
            <ViewerBar
              viewport={viewport}
              publication={publication}
              account={account}
              workspace={workspace}
              project={project}
            />
          }
        >
          {children}
        </ViewerStage>
      )}
    </>
  );
}
