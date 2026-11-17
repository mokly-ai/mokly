import type { Build, HistoryEntry, Publication } from "../../api/types";
import { Action } from "../../components/action";
import { ContentList } from "../../components/controls";
import type { ContentRow, WaitingContentRow } from "../../components/controls";
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

function publicationRow(
  publication: Publication,
  context: RowContext,
): ContentRow {
  const current = publication.id === context.currentId;
  const state = publicationState(publication);
  const openable = state === "ready" || state === "failed";
  return {
    id: publication.id,
    title: publishedMoment(publication.publishedAt),
    detail: detailFor(publication, current),
    status: publicationTones[state],
    meta: shortSha(publication.headSha),
    mono: true,
    ...(current || !openable
      ? {}
      : {
          href: publicationPath(
            context.workspaceSlug,
            context.projectSlug,
            publication.id,
          ),
          action: state === "failed" ? "Details" : "Open",
        }),
  };
}

/**
 * A build stands for its own upload until that upload commits, in the words a
 * publication uses: Publishing now while it runs and Unable to publish once it
 * failed. Its details are the build's own address.
 */
function buildRow(build: Build, context: RowContext): ContentRow {
  const state = buildActive(build.state) ? "publishing" : "failed";
  return {
    id: build.id,
    title: publishedMoment(build.createdAt),
    detail: state === "publishing" ? "Publishing now" : "Unable to publish",
    status: publicationTones[state],
    meta: shortSha(build.headSha),
    mono: true,
    ...(build.id === context.currentBuildId
      ? {}
      : {
          href: buildPath(context.workspaceSlug, context.projectSlug, build.id),
          action: "Details",
        }),
  };
}

function rowFor(entry: HistoryEntry, context: RowContext): ContentRow {
  return entry.kind === "build"
    ? buildRow(entry.build, context)
    : publicationRow(entry.publication, context);
}

/**
 * An entry while the history's read runs: its state, its time and its head
 * are the read's, and its way on keeps its label as text.
 */
const waitingEntry: WaitingContentRow = {
  id: "waiting",
  waiting: true,
  title: "",
  detail: "",
  status: true,
  meta: true,
  mono: true,
  action: "Open",
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
            <ContentList label={label} rows={[waitingEntry]} />
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
            <ContentList
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
