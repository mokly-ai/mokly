import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import { StatusDot } from "../../../entries/design/status-dot.mockup";
import type { PublicationState } from "../../../fixtures/publications";
import { publicationTones } from "../../../fixtures/publications";
import { sample } from "../../../fixtures/product";
import { Pending } from "../page-parts";
import { StatePlaceholder } from "../placeholders";
import { ViewerStage } from "../shell";
import { ViewerBar } from "./bar";
import type {
  PublishedAccountLabel,
  PublishedSubject,
} from "./published-slots";
import { PublishedViewer } from "./published-viewer";
import { StageCard } from "./stage-card";

/** What the middle slot says about the publication the stage is showing. */
export function PublicationMeta({
  state,
  detail,
  sha,
  children,
}: {
  state: PublicationState;
  detail: string;
  sha?: string;
  children?: ReactNode;
}) {
  return (
    <span className="fo-top-state">
      <StatusDot
        moklyInstance={"viewer-state-" + state}
        tone={publicationTones[state]}
      />
      <span className="fo-top-state-detail">{detail}</span>
      {sha && <code className="mono-value">{sha}</code>}
      {children}
    </span>
  );
}

/**
 * What the bar calls the reader. Every account is created by an email address,
 * so somebody who has not set a name is named by theirs; the whole address is
 * wider than the compact bar's first row, which is why that row keeps the part
 * that identifies them and the whole address stays the control's accessible
 * name and its tooltip.
 */
export type AccountLabel = PublishedAccountLabel;

/**
 * The two forms of the chrome. The published form draws the ready viewer,
 * whose own slots draw the publication trigger, so it refuses a
 * `publication` and a wait. The fallback form draws the cloud's bar, which
 * shows the `publication` that it requires, also while it waits.
 */
type ViewerChromeProps = {
  viewport: Viewport;
  heading?: string;
  /** Who the bar calls the reader, when it is not their own display name. */
  account?: AccountLabel;
  workspace?: string;
  project?: string;
  children?: ReactNode;
  publishedSubject?: PublishedSubject;
  comparisonBlocked?: boolean;
  view?: "all" | "changes";
} & (
  | { published: true; publication?: never; waiting?: never }
  | {
      published?: false;
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
 */
export function ViewerChrome({
  viewport,
  heading,
  publication,
  account = { label: sample.viewer.name },
  workspace = sample.workspace,
  project = sample.project,
  children,
  published = false,
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
