import type { Viewport } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { listedBranches, pullRequests } from "../../../fixtures/publications";
import { Action, Pending, StateMessage } from "../page-parts";

import { RefGroup } from "./rows";
import { ViewerPanelScreen } from "./screen";

const title = "Branches and pull requests";

/**
 * A project Mokly has not observed yet has no branches and no pull requests,
 * which is different from a search that matches none of them: only one of the
 * two has a search to clear. Setting publishing up is an administrator's
 * action, so only an administrator is offered it.
 */
function NoReferences() {
  return (
    <StateMessage
      title="No branches yet"
      icon="branch"
      action={
        <Action
          instance="switcher-set-up-publishing"
          label="Set up publishing"
          to="product/account/project-created/empty"
          tone="primary"
          size="md"
          icon="external"
        />
      }
    >
      Branches appear here once Mokly has seen this repository.
    </StateMessage>
  );
}

function SwitcherPage({
  state,
  viewport,
  screen,
  references = true,
}: {
  state: ScreenState;
  viewport: Viewport;
  screen?: string;
  /** Whether Mokly has observed this repository's branches at all. */
  references?: boolean;
}) {
  return (
    <ViewerPanelScreen
      id="product/viewer/switcher"
      state={state}
      viewport={viewport}
      title={title}
      close="product/viewer/standalone"
      screen={screen}
    >
      <div className="fo-panel-stack">
        <Input
          label="Find a branch or pull request"
          name="publication-search"
          type="text"
          value={state === "empty" ? "settings" : ""}
          disabled={state === "loading" || state === "error"}
        />
        {state === "loading" ? (
          // The search keeps its place, disabled until there is something to
          // search. Each list draws one placeholder row, and its name is for
          // screen readers only, because no text place here is the read's.
          <Pending label="Loading branches" labelMode="screen-reader-only">
            <RefGroup
              instance="switcher-branches"
              label="Branches"
              waiting="6em"
            />
            <RefGroup
              instance="switcher-pull-requests"
              label="Pull requests"
              waiting="9em"
            />
          </Pending>
        ) : state === "error" ? (
          <StateMessage
            title="Branches couldn’t load"
            error
            reference={failureReference}
            action={
              <Action
                instance="switcher-retry"
                label="Try again"
                to="product/viewer/switcher"
                tone="primary"
                size="md"
                icon="retry"
              />
            }
          />
        ) : state === "empty" ? (
          <StateMessage title="No branch or pull request matches">
            Clear the search to see every branch and pull request.
          </StateMessage>
        ) : !references ? (
          <NoReferences />
        ) : (
          <>
            <RefGroup
              instance="switcher-branches"
              label="Branches"
              refs={listedBranches}
              destination="product/viewer/standalone"
              building="product/viewer/standalone/publish/publishing"
              unpublished="product/viewer/standalone/publish"
            />
            <RefGroup
              instance="switcher-pull-requests"
              label="Pull requests"
              refs={pullRequests}
              destination="product/viewer/pull-request"
              building="product/viewer/pull-request/publishing"
              unpublished="product/viewer/standalone/publish/pull-request"
            />
          </>
        )}
      </div>
    </ViewerPanelScreen>
  );
}

export function ViewerSwitcherScreen({ viewport }: { viewport: Viewport }) {
  return <SwitcherPage viewport={viewport} state="default" />;
}

export function ViewerSwitcherEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <SwitcherPage viewport={viewport} state="empty" />;
}

export function ViewerSwitcherLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <SwitcherPage viewport={viewport} state="loading" />;
}

export function ViewerSwitcherErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <SwitcherPage viewport={viewport} state="error" />;
}

/** The switcher in a project Mokly has not seen a repository for yet. */
export function ViewerSwitcherNoBranchesScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <SwitcherPage
      viewport={viewport}
      state="default"
      screen="product/viewer/switcher/no-branches"
      references={false}
    />
  );
}
