import { useState } from "react";

import { Action } from "../../components/action";
import { Field } from "../../components/field";
import type { ContentRow } from "../../components/controls";
import { PaneResource } from "../../components/resource-state";
import { Pending, StateMessage } from "../../components/page-parts";
import { useResource } from "../../data/use-resource";
import { everyBranch, everyPullRequest } from "../../data/publications";
import type { ReferenceRowState } from "../build-state";
import { publicationTones, publishedDay, shortSha } from "../resolution";
import { rowTarget } from "../switcher-row";
import type { RefRow } from "../switcher-row";
import { RefGroup } from "./ref-group";

/** Everything the switcher shows, read so that no row states another's facts. */
interface Refs {
  branches: readonly RefRow[];
  pullRequests: readonly RefRow[];
  /** Whether the read stopped at its cap with references still unread. */
  truncated: boolean;
}

/**
 * Every reference of the project, each carrying its own newest attempt.
 *
 * No request per reference: the state, time and head a row shows come from the
 * row itself, so nothing here asks a reference for its history. What scales is
 * pages rather than references — one read per page of each list, bounded by
 * `referencePageLimit`. Both lists are followed to their last page, because a
 * switcher that showed only the first fifty branches would leave a reader
 * unable to reach the rest and say nothing about it.
 */
async function readRefs(projectId: string): Promise<Refs> {
  const [branches, pullRequests] = await Promise.all([
    everyBranch(projectId),
    everyPullRequest(projectId),
  ]);
  return {
    branches: branches.items.map((branch) => ({
      ref: { kind: "branch", name: branch.name },
      title: branch.name,
      ready: branch.latestPublicationId,
      newest: branch.newestPublication,
      newestBuild: branch.newestBuild,
    })),
    pullRequests: pullRequests.items.map((pull) => ({
      ref: { kind: "pull-request", number: pull.number },
      title: "#" + pull.number + " " + pull.title,
      author: pull.author ?? undefined,
      ready: pull.latestPublicationId,
      newest: pull.newestPublication,
      newestBuild: pull.newestBuild,
    })),
    truncated: branches.truncated || pullRequests.truncated,
  };
}

/** What one reference's newest attempt says about itself. */
function detailFor(row: ReferenceRowState): string {
  if (row.state === "ready" && row.publishedAt) {
    return "Published " + publishedDay(row.publishedAt);
  }
  if (row.state === "publishing") return "Publishing now";
  if (row.state === "failed") return "Unable to publish";
  return "No publication yet";
}

/**
 * One reference's row. Its state comes from the newer of its newest
 * publication and newest build, and its short SHA from whichever that was.
 * Opening it resolves the reference, so a ready publication still wins over a
 * newer build. Details on a reference with nothing ready opens its failed
 * attempt's own address — a failed build's address or a failed publication's
 * details — whatever card the reference's stage shows.
 */
function rowFor(
  row: RefRow,
  workspaceSlug: string,
  projectSlug: string,
): ContentRow {
  const { state, href, details } = rowTarget(row, workspaceSlug, projectSlug);
  const detail = detailFor(state);
  return {
    id: row.ref.kind + ":" + row.title,
    title: row.title,
    detail: row.author ? row.author + " · " + detail : detail,
    status: publicationTones[state.state],
    meta: shortSha(state.headSha),
    mono: true,
    href,
    action: details ? "Details" : "Open",
  };
}

function matching(rows: readonly ContentRow[], search: string): ContentRow[] {
  const needle = search.trim().toLowerCase();
  if (needle.length === 0) return [...rows];
  return rows.filter((row) => row.title.toLowerCase().includes(needle));
}

/**
 * What a capped read shows, in the one sentence that is true of it.
 *
 * The walk stops at `referencePageLimit`, and a list that stopped early looks
 * exactly like a complete one. The count is what was read rather than what
 * exists, because the read stopped before anything could count the rest.
 *
 * No action is offered. The search filters the rows already read, so it cannot
 * reach a reference past the cap, and the product has no control that opens one
 * by name — an instruction that cannot work costs the reader the effort of
 * trying it and leaves them believing the reference is gone. Milestone 13J
 * takes the search term to the API, which is what makes an action true here.
 */
function capped(shown: number): string {
  return (
    "This list shows the first " +
    shown.toLocaleString() +
    " branches and pull requests."
  );
}

/**
 * The same sentence where the reader who cannot find their branch is looking:
 * directly under the search field, above the rows. At the foot of the list it
 * sat past a thousand rows, so a capped list still looked complete to anyone
 * who did not scroll to the very end.
 */
function MoreReferences({ shown }: { shown: number }) {
  return (
    <StateMessage
      title="More branches and pull requests"
      icon="branch"
      testID="switcher-more-references"
    >
      {capped(shown)}
    </StateMessage>
  );
}

/**
 * A project Mokly has observed nothing of yet. With no search to clear, the one
 * way on is to publish, which only a reader who administers the project is
 * offered: its address is absent for everyone else.
 */
export function NoBranches({ setUpPublishing }: { setUpPublishing?: string }) {
  return (
    <StateMessage
      title="No branches yet"
      icon="branch"
      action={
        setUpPublishing ? (
          <Action
            label="Set up publishing"
            tone="primary"
            size="md"
            icon="external"
            href={setUpPublishing}
            testID="switcher-set-up-publishing"
          />
        ) : undefined
      }
    >
      Branches appear here once Mokly has seen this repository.
    </StateMessage>
  );
}

/**
 * Every reference the reader can open: the repository's branches with the
 * default first, then its pull requests. Each row carries what its newest
 * attempt did, so choosing one is a decision the reader can make from the list
 * rather than by opening it.
 */
export function SwitcherPanel({
  projectId,
  workspaceSlug,
  projectSlug,
  onFollow,
  setUpPublishing,
}: {
  projectId: string;
  workspaceSlug: string;
  projectSlug: string;
  onFollow: (href: string) => void;
  /**
   * Where Set up publishing goes; absent for a reader who does not administer
   * the project, as on the stage.
   */
  setUpPublishing?: string;
}) {
  const [search, setSearch] = useState("");
  const refs = useResource(
    () => readRefs(projectId),
    "viewer-refs:" + projectId,
  );
  return (
    <div className="fo-panel-stack">
      <Field
        label="Find a branch or pull request"
        name="publication-search"
        value={search}
        onChange={setSearch}
        disabled={refs.state.status !== "ready"}
      />
      <PaneResource
        resource={refs.state}
        waiting={
          // The search keeps its place, disabled until there is something to
          // search. No text place here is the read's, so it is named for
          // screen readers only.
          <Pending label="Loading branches" labelMode="screen-reader-only">
            <RefGroup label="Branches" waiting="6em" />
            <RefGroup label="Pull requests" waiting="9em" />
          </Pending>
        }
        failure="Branches couldn’t load"
        onRetry={refs.reload}
      >
        {(value) => {
          const follow = (rows: readonly RefRow[]) =>
            rows
              .map((row) => rowFor(row, workspaceSlug, projectSlug))
              .map((row) => ({
                ...row,
                onFollow: () => onFollow(row.href as string),
              }));
          const branches = matching(follow(value.branches), search);
          const pulls = matching(follow(value.pullRequests), search);
          const shown = value.branches.length + value.pullRequests.length;
          if (branches.length === 0 && pulls.length === 0) {
            // A search that matches nothing and a project that has nothing are
            // different states, and only one of them has a search to clear.
            return search.trim().length > 0 ? (
              // One card, not two. While the read is capped, the reason a
              // search found nothing is the cap rather than the search, and
              // "clear the search to see every branch" is false beside it:
              // clearing it shows the same thousand.
              <StateMessage title="No branch or pull request matches">
                {value.truncated
                  ? capped(shown)
                  : "Clear the search to see every branch and pull request."}
              </StateMessage>
            ) : (
              <NoBranches setUpPublishing={setUpPublishing} />
            );
          }
          return (
            <>
              {value.truncated && <MoreReferences shown={shown} />}
              <RefGroup label="Branches" rows={branches} />
              <RefGroup label="Pull requests" rows={pulls} />
            </>
          );
        }}
      </PaneResource>
    </div>
  );
}
