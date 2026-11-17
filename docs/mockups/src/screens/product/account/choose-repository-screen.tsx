import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import type { ScreenState } from "../../../fixtures/product-states";
import { stateScreenPath } from "../../../fixtures/product-states";
import { AccountShell } from "./account-shell";
import { RepositoryForm } from "./choose-repository-form";
import type { RepositoryActivity } from "./choose-repository-form";
import { PublishWithCli } from "./cli-link";
import type { Accounts } from "./repository-field";

/**
 * The step for a workspace with two connected accounts unless a drawing says
 * otherwise. The route draws it only for a connected workspace, which is the
 * CLI form it offers, and a project made from an installed repository builds.
 * While the step reads, where the line to the CLI form leads is not known yet,
 * so the line draws its words as text.
 */
function ChooseRepositoryPage({
  state,
  accounts = "several",
  open,
  slugRefused,
  activity,
  screen,
}: {
  state: ScreenState;
  accounts?: Accounts;
  open?: boolean;
  slugRefused?: boolean;
  activity?: RepositoryActivity;
  screen?: string;
}) {
  const frame = {
    id: screen ?? stateScreenPath("product/account/choose-repository", state),
    title: "Choose a repository",
    identity: { kind: "signed-in" },
    step: 3,
  } as const;
  const body = (waiting?: ReactNode) => (
    <RepositoryForm
      state={state}
      accounts={accounts}
      open={open}
      slugRefused={slugRefused}
      activity={activity}
      waiting={waiting}
    />
  );
  return state === "loading" ? (
    <AccountShell
      {...frame}
      wait="Loading repositories"
      below={<PublishWithCli waiting />}
    >
      {(name) => body(name)}
    </AccountShell>
  ) : (
    <AccountShell
      {...frame}
      below={<PublishWithCli installation="connected" />}
    >
      {body()}
    </AccountShell>
  );
}

export function ChooseRepositoryScreen(_props: { viewport: Viewport }) {
  return <ChooseRepositoryPage state="default" />;
}

export function ChooseRepositoryEmptyScreen(_props: { viewport: Viewport }) {
  return <ChooseRepositoryPage state="empty" />;
}

/** The workspace and repository reads: the step's own form, waiting. */
export function ChooseRepositoryLoadingScreen(_props: { viewport: Viewport }) {
  return <ChooseRepositoryPage state="loading" />;
}

export function ChooseRepositoryErrorScreen(_props: { viewport: Viewport }) {
  return <ChooseRepositoryPage state="error" />;
}

export function ChooseRepositorySlugTakenScreen(_props: {
  viewport: Viewport;
}) {
  return (
    <ChooseRepositoryPage
      state="default"
      slugRefused
      screen="product/account/choose-repository/slug-taken"
    />
  );
}

export function ChooseRepositorySuggestionErrorScreen(_props: {
  viewport: Viewport;
}) {
  return (
    <ChooseRepositoryPage
      state="default"
      activity="suggestion-error"
      screen="product/account/choose-repository/slug-taken/empty"
    />
  );
}

export function ChooseRepositorySuggestionLoadingScreen(_props: {
  viewport: Viewport;
}) {
  return (
    <ChooseRepositoryPage
      state="default"
      activity="suggestion-loading"
      screen="product/account/choose-repository/suggestion-loading"
    />
  );
}

/** Create project's write: the form, with the control busy. */
export function ChooseRepositoryCreatingScreen(_props: { viewport: Viewport }) {
  return (
    <ChooseRepositoryPage
      state="default"
      activity="creating"
      screen="product/account/choose-repository/creating"
    />
  );
}

/** The grouped select open, one titled section per connected account. */
export function ChooseRepositoryOpenScreen(_props: { viewport: Viewport }) {
  return (
    <ChooseRepositoryPage
      state="default"
      open
      screen="product/account/choose-repository/open"
    />
  );
}

/** A workspace with one connected account: the select is flat. */
export function ChooseRepositoryOneAccountScreen(_props: {
  viewport: Viewport;
}) {
  return (
    <ChooseRepositoryPage
      state="default"
      accounts="one"
      screen="product/account/choose-repository/one-account"
    />
  );
}
