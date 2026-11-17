import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import { Selector } from "../../../entries/design/selector.mockup";
import { sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  failureReference,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { workspaces } from "../../../fixtures/publications";
import { Action, Facts, StateMessage } from "../page-parts";
import { ControlPlaceholder } from "../placeholders";
import { AccountShell } from "./account-shell";

/**
 * The four states, the address that names one workspace or a reader with one,
 * and Continue on GitHub while its write runs.
 */
type Situation = ScreenState | "one-workspace" | "connecting";

/** Only a workspace the reader administers can take a GitHub account. */
const administered = workspaces.filter((candidate) => candidate.administrator);

/**
 * Where the account goes: a select when the reader administers several
 * workspaces and the address names none, and a fact when there is only one
 * place it can go. The one action leaves for GitHub to prove the reader
 * administers the account, and returns to the repository step. While the
 * workspaces are read, `waiting` is the read's name: the select holds it, and
 * the control, whose label the workspaces decide, is a placeholder in its own
 * box. While the control's write runs, it carries the wait until the page
 * leaves for GitHub, and the choice stays as the reader left it.
 */
function Destination({
  situation,
  waiting,
  connecting = false,
}: {
  situation: "default" | "one-workspace";
  waiting?: ReactNode;
  connecting?: boolean;
}) {
  const waits = waiting !== undefined;
  return (
    <>
      {situation === "one-workspace" ? (
        <Facts ruled rows={[["Workspace", sample.workspace]]} />
      ) : (
        <div className="fo-account-selector">
          {waits ? (
            <Selector
              moklyInstance="connect-workspace"
              label="Workspace"
              waiting
              options={[]}
              hold={waiting}
            />
          ) : (
            <Selector
              moklyInstance="connect-workspace"
              label="Workspace"
              value={sample.workspace}
              options={administered.map((candidate) => ({
                value: candidate.name,
                label: candidate.name,
              }))}
            />
          )}
        </div>
      )}
      <div className="fo-account-actions">
        {waits ? (
          <ControlPlaceholder />
        ) : connecting ? (
          <Action
            label="Connecting…"
            tone="primary"
            icon="github"
            block
            busy="Connecting a GitHub account"
          />
        ) : (
          <Action
            label="Continue on GitHub"
            to="product/account/choose-repository"
            tone="primary"
            icon="github"
            block
          />
        )}
      </div>
    </>
  );
}

function ConnectBody({
  situation,
}: {
  situation: Exclude<Situation, "loading">;
}) {
  if (situation === "error")
    return (
      <>
        <StateMessage
          title="Workspaces couldn’t load"
          error
          reference={failureReference}
        />
        <div className="fo-account-actions">
          <Action
            label="Try again"
            to="product/account/install-app/connect"
            tone="primary"
            icon="retry"
            block
          />
        </div>
      </>
    );
  if (situation === "empty")
    return (
      <div className="fo-account-actions">
        <Action
          label="Create a workspace"
          to="product/account/create-workspace"
          tone="primary"
          block
        />
      </div>
    );
  if (situation === "connecting")
    return <Destination situation="default" connecting />;
  return <Destination situation={situation} />;
}

/**
 * An installation that arrived from GitHub with no flow behind it: Configure
 * on GitHub, or an install started there. Nothing is connected until the
 * reader chooses the workspace and GitHub proves they administer the account,
 * so the step names no account. A reader with no workspace to put it in makes
 * one first, which keeps the order Workspace, Install, Repository; the strip
 * claims the workspace only once the reader is known to have one.
 */
function ConnectPage({ situation }: { situation: Situation }) {
  const known =
    situation === "default" ||
    situation === "one-workspace" ||
    situation === "connecting";
  if (situation === "loading")
    // The workspaces decide whether a select, a fact or Create a workspace is
    // drawn, so the step draws its most common form, the select, waiting.
    return (
      <AccountShell
        id={stateScreenPath("product/account/install-app/connect", situation)}
        title="Connect a GitHub account"
        identity={{ kind: "signed-in" }}
        step={2}
        complete={[]}
        wait="Loading your workspaces"
      >
        {(name) => <Destination situation="default" waiting={name} />}
      </AccountShell>
    );
  return (
    <AccountShell
      id={stateScreenPath("product/account/install-app/connect", situation)}
      title="Connect a GitHub account"
      detail={
        situation === "empty"
          ? "Create a workspace to connect this account."
          : undefined
      }
      identity={{ kind: "signed-in" }}
      step={2}
      complete={known ? [1] : []}
    >
      <ConnectBody situation={situation} />
    </AccountShell>
  );
}

export function ConnectScreen(_props: { viewport: Viewport }) {
  return <ConnectPage situation="default" />;
}

export function ConnectEmptyScreen(_props: { viewport: Viewport }) {
  return <ConnectPage situation="empty" />;
}

export function ConnectLoadingScreen(_props: { viewport: Viewport }) {
  return <ConnectPage situation="loading" />;
}

export function ConnectErrorScreen(_props: { viewport: Viewport }) {
  return <ConnectPage situation="error" />;
}

export function ConnectOneWorkspaceScreen(_props: { viewport: Viewport }) {
  return <ConnectPage situation="one-workspace" />;
}

/** Continue on GitHub while its write runs, busy until the page leaves. */
export function ConnectConnectingScreen(_props: { viewport: Viewport }) {
  return <ConnectPage situation="connecting" />;
}
