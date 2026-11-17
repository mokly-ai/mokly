import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import { MenuSheet } from "../../../components/responsive-menu";
import { githubAccounts } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, StateMessage } from "../page-parts";
import { accountMenu, ConnectedAccounts } from "./github-accounts";
import type { Reader } from "./github-accounts";
import { SettingsSurface } from "./surface";

/**
 * The pane: every GitHub account the workspace connects, and the one control
 * that adds another. Adding leaves for GitHub and returns here, and removing
 * is asked in a modal over the row it concerns, so the list keeps its place.
 * On mobile a row's open menu is a sheet over the whole layer, so it takes the
 * same modal slot.
 */
export function GitHubPane({
  state,
  viewport,
  reader = "administrator",
  suspended = false,
  menuOpen = false,
  adding = false,
  modal,
  screen,
}: {
  state: ScreenState;
  viewport: Viewport;
  reader?: Reader;
  /** Whether GitHub has suspended the first account's installation. */
  suspended?: boolean;
  /** Whether the first account's row menu is open. */
  menuOpen?: boolean;
  /** Whether Add GitHub account's write is running. */
  adding?: boolean;
  modal?: ReactNode;
  screen?: string;
}) {
  const administers = reader === "administrator";
  const opened = menuOpen ? githubAccounts[0] : undefined;
  const overlay =
    opened && viewport === "mobile" ? (
      <MenuSheet {...accountMenu(opened)} />
    ) : (
      modal
    );
  return (
    <SettingsSurface
      pane="github"
      state={state}
      screen={screen}
      modal={overlay}
      viewport={viewport}
      title="GitHub accounts"
    >
      {state === "loading" ? (
        <Pending label="Loading GitHub accounts" labelMode="screen-reader-only">
          <ConnectedAccounts reader={reader} waiting />
        </Pending>
      ) : state === "error" ? (
        <StateMessage
          title="GitHub accounts couldn’t load"
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              to="product/settings/github"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      ) : state === "empty" ? (
        <StateMessage
          title="No GitHub accounts yet"
          icon="github"
          action={
            administers ? (
              <Action
                label="Add GitHub account"
                tone="primary"
                size="md"
                icon="start"
              />
            ) : undefined
          }
        />
      ) : (
        <ConnectedAccounts
          reader={reader}
          suspended={suspended}
          opened={opened}
          adding={adding}
        />
      )}
    </SettingsSurface>
  );
}

export function SettingsGitHubScreen({ viewport }: { viewport: Viewport }) {
  return <GitHubPane viewport={viewport} state="default" />;
}

export function SettingsGitHubEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <GitHubPane viewport={viewport} state="empty" />;
}

export function SettingsGitHubLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <GitHubPane viewport={viewport} state="loading" />;
}

export function SettingsGitHubErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <GitHubPane viewport={viewport} state="error" />;
}

/** The organization's installation suspended on GitHub, beside the way back. */
export function SettingsGitHubSuspendedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <GitHubPane
      viewport={viewport}
      state="default"
      suspended
      screen="product/settings/github/suspended"
    />
  );
}

/** The same accounts read by a member: no row menus and no way to add one. */
export function SettingsGitHubMemberScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <GitHubPane
      viewport={viewport}
      state="default"
      reader="member"
      screen="product/settings/github/member"
    />
  );
}

/** The first row's own actions, open: Manage on GitHub, then Remove. */
export function SettingsGitHubMenuScreen({ viewport }: { viewport: Viewport }) {
  return (
    <GitHubPane
      viewport={viewport}
      state="default"
      menuOpen
      screen="product/settings/github/menu"
    />
  );
}

/** Add GitHub account's write, busy with Adding… until the page leaves. */
export function SettingsGitHubAddingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <GitHubPane
      viewport={viewport}
      state="default"
      adding
      screen="product/settings/github/adding"
    />
  );
}
