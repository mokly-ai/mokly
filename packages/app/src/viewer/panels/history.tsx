import type { Build, HistoryEntry, Publication } from "../../api/types";
import { Action } from "../../components/action";
import { Pending, StateMessage } from "../../components/page-parts";
import { PaneResource } from "../../components/resource-state";
import { listHistory } from "../../data/builds";
import type { PublicationRef } from "../../data/publications";
import { useResource } from "../../data/use-resource";
import { buildPath, publicationPath } from "../../navigation/paths";
import { buildActive } from "../build-state";
import {
  publicationState,
  publicationTones,
  publishedMoment,
  shortSha,
} from "../resolution";

import { PanelList } from "./panel-rows";
import type { PanelRow, WaitingPanelRow } from "./panel-rows";

/** What one earlier attempt on this reference says about itself. */
function detailFor(publication: Publication, current: boolean): string {
  if (current) return "Current publication";
  const state = publicationState(publication);
  if (state === "ready") return "Ready";
  if (state === "failed") return "Unable to publish";
  if (state === "publishing") return "Publishing now";
  return "No longer kept";
}

/** Where history rows lead, and which entry the stage is already showing. */
interface RowContext {
  workspaceSlug: string;
  projectSlug: string;
  currentId?: string;
  currentBuildId?: string;
}

/**
 * The publication the stage shows is where the reader already is, so it takes
 * the signal-soft fill and carries no destination, and its state line already
 * says Current publication, so it carries no mark either.
 */
function publicationRow(
  publication: Publication,
  context: RowContext,
): PanelRow {
  const current = publication.id === context.currentId;
  const state = publicationState(publication);
  const openable = state === "ready" || state === "failed";
  return {
    id: publication.id,
    title: publishedMoment(publication.publishedAt),
    detail: detailFor(publication, current),
    status: publicationTones[state],
    sha: shortSha(publication.headSha),
    current,
    ...(current || !openable
      ? {}
      : {
          href: publicationPath(
            context.workspaceSlug,
            context.projectSlug,
            publication.id,
          ),
        }),
  };
}

/**
 * A build stands for its own upload until that upload commits, in the words a
 * publication uses: Publishing now while it runs and Unable to publish once it
 * failed. Its details are the build's own address, and the build the stage
 * shows is where the reader already is, as the current publication is.
 */
function buildRow(build: Build, context: RowContext): PanelRow {
  const state = buildActive(build.state) ? "publishing" : "failed";
  const current = build.id === context.currentBuildId;
  return {
    id: build.id,
    title: publishedMoment(build.createdAt),
    detail: state === "publishing" ? "Publishing now" : "Unable to publish",
    status: publicationTones[state],
    sha: shortSha(build.headSha),
    current,
    ...(current
      ? {}
      : {
          href: buildPath(context.workspaceSlug, context.projectSlug, build.id),
        }),
  };
}

function rowFor(entry: HistoryEntry, context: RowContext): PanelRow {
  return entry.kind === "build"
    ? buildRow(entry.build, context)
    : publicationRow(entry.publication, context);
}

/**
 * An entry while the history's read runs: its state, its time and its head
 * are the read's, and its way on keeps its label as text.
 */
const waitingEntry: WaitingPanelRow = {
  id: "waiting",
  waiting: true,
  title: "",
  detail: "",
  status: true,
  sha: true,
};

/**
 * This reference's publications and builds, newest first. Every row is an
 * immutable link, a failed attempt opens its own details rather than an absent
 * catalogue, and a build opens its build's details.
 */
export function HistoryPanel({
  projectId,
  workspaceSlug,
  projectSlug,
  currentId,
  currentBuildId,
  refLabel,
  publicationRef,
  onFollow,
  onChoose,
}: {
  projectId: string;
  workspaceSlug: string;
  projectSlug: string;
  currentId?: string;
  currentBuildId?: string;
  refLabel?: string;
  publicationRef?: PublicationRef;
  onFollow: (href: string) => void;
  onChoose: () => void;
}) {
  const key = publicationRef
    ? publicationRef.kind + ":" + refLabel
    : "everything";
  const history = useResource(
    () => listHistory(projectId, publicationRef),
    "viewer-history:" + projectId + ":" + key,
  );
  const context = { workspaceSlug, projectSlug, currentId, currentBuildId };
  const label = refLabel ? "Publications of " + refLabel : "Every publication";
  return (
    <div className="fo-panel-stack">
      <PaneResource
        resource={history.state}
        waiting={
          // The list draws one placeholder row in the row's own frame. No
          // text place here is the read's, so it is named for screen readers.
          <Pending
            label="Loading publication history"
            labelMode="screen-reader-only"
          >
            <PanelList label={label} rows={[waitingEntry]} />
          </Pending>
        }
        failure="History couldn’t load"
        onRetry={history.reload}
      >
        {(items) =>
          items.length === 0 ? (
            <StateMessage
              title="No earlier publications"
              icon="branch"
              action={
                <Action
                  label="Choose another branch"
                  tone="primary"
                  size="md"
                  onPress={onChoose}
                  testID="history-choose-publication"
                />
              }
            />
          ) : (
            <PanelList
              label={label}
              rows={items.map((entry) => {
                const row = rowFor(entry, context);
                return row.href
                  ? { ...row, onFollow: () => onFollow(row.href as string) }
                  : row;
              })}
            />
          )
        }
      </PaneResource>
    </div>
  );
}
