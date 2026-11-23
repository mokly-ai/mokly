import { InputFrame } from "@firna/ui/input";

import type { Viewport } from "@mokly/mokly";

import { staticNoop } from "../../../components/static-controls";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import {
  listedBranches,
  publication,
  pullRequests,
} from "../../../fixtures/publications";
import { icons } from "../icons";
import { Action, Pending, StateMessage } from "../page-parts";

import { RefGroup } from "./rows";
import { ViewerPanelScreen } from "./screen";

const title = "Branches and pull requests";

/** What the search finds, which names the field. */
const searchLabel = "Find a branch or pull request";

/**
 * The search that leads the switcher, in the bar in place of the visible
 * title: the package's plain field with the search glyph, which the field's
 * own name labels for assistive technology and shows as its placeholder.
 * While the references load or fail it keeps its place, disabled until there
 * is something to search.
 */
function SwitcherSearch({
  value,
  disabled,
  viewport,
}: {
  value: string;
  disabled: boolean;
  viewport: Viewport;
}) {
  return (
    <div className={disabled ? "fo-canvas-search-off" : undefined}>
      <InputFrame
        nativeID="publication-search"
        accessibilityLabel={searchLabel}
        placeholder={searchLabel}
        prefixIcon={icons.search}
        variant="plain"
        size={viewport === "mobile" ? "lg" : "md"}
        value={value}
        onChangeText={staticNoop}
        autoComplete="off"
        editable={!disabled}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      />
    </div>
  );
}

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
      search={
        <SwitcherSearch
          value={state === "empty" ? "settings" : ""}
          disabled={state === "loading" || state === "error"}
          viewport={viewport}
        />
      }
    >
      <div className="fo-panel-stack">
        {state === "loading" ? (
          // The search keeps its place, disabled until there is something to
          // search. Each list draws one placeholder row, and its name is for
          // screen readers only, because no text place here is the read's.
          <Pending label="Loading branches" labelMode="screen-reader-only">
            <RefGroup kind="branch" label="Branches" waiting="6em" />
            <RefGroup kind="pullRequest" label="Pull requests" waiting="9em" />
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
              kind="branch"
              label="Branches"
              refs={listedBranches}
              destination="product/viewer/standalone"
              building="product/viewer/standalone/publish/publishing"
              unpublished="product/viewer/standalone/publish"
              current={publication.branch}
            />
            <RefGroup
              kind="pullRequest"
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
