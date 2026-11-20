import { DropdownSelector } from "@firna/ui/dropdown";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { User } from "../../api/types";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Facts, Pending, StateMessage } from "../../components/page-parts";
import {
  ControlPlaceholder,
  SelectorPlaceholder,
} from "../../components/placeholders";
import { installGitHubApp } from "../../data/auth";
import { useResource } from "../../data/use-resource";
import { listEveryWorkspace } from "../../data/workspaces";
import { useCompact } from "../../layout/viewport";
import { isDesktopShell } from "../../navigation/desktop-shell";
import {
  connectInstallationPath,
  createWorkspaceForPath,
  installStepPath,
} from "../../navigation/paths";
import { openOnWeb } from "../../navigation/web-setup";
import { alwaysSendable, nothingToDo, useWrite } from "../../settings/write";

import { AccountShell } from "./account-shell";
import type { WaitingIdentity } from "./account-shell";
import { connectDestination } from "./connect-destination";
import type { ConnectDestination } from "./connect-destination";
import { InstallRefusal } from "./install-refusal";
import { completedSteps } from "./setup-progress";

/** The frame of the connect situation, which its every form shares. */
const frame = {
  screen: "account-connect-installation",
  title: "Connect a GitHub account",
  step: 2,
} as const;

/**
 * Where the account goes and the one action, loaded or waiting: the choice of
 * workspace above the control that leaves for GitHub.
 */
function DestinationLayout({
  choice,
  control,
}: {
  choice: ReactNode;
  control: ReactNode;
}) {
  return (
    <>
      {choice}
      <div className="fo-account-actions">{control}</div>
    </>
  );
}

/**
 * The connect situation while the session or the workspaces are read. The
 * workspaces decide whether a select, a fact or Create a workspace is drawn,
 * so it draws its most common form, the select, holding the read's name, with
 * the control as a placeholder in its own box. The strip claims no step,
 * because the reader may have no workspace yet.
 */
export function ConnectWait({ identity }: { identity: WaitingIdentity }) {
  return (
    <AccountShell
      {...frame}
      identity={identity}
      complete={completedSteps({ workspace: false })}
      wait={(panel) => (
        <Pending label="Loading your workspaces">{panel}</Pending>
      )}
    >
      {(name) => (
        <DestinationLayout
          choice={
            <div className="fo-account-selector">
              <SelectorPlaceholder label="Workspace" hold={name} />
            </div>
          }
          control={<ControlPlaceholder />}
        />
      )}
    </AccountShell>
  );
}

/**
 * The workspace the account goes to, and the one action: a select when the
 * reader administers several and the address names none, a fact when there
 * is only one place it can go. Continue on GitHub starts the flow with the
 * arriving installation recorded as its candidate and leaves for GitHub's
 * authorization, which proves the reader administers the account; the flow
 * returns to that workspace's install step, which hands a connected
 * workspace on to the repository step. The control stays busy until the page
 * leaves for GitHub. In the desktop app's window it opens this step's own
 * address on the web instead, where the reader connects the account from the
 * browser, so it carries the external glyph there.
 */
function Destination({
  destination,
  installationId,
  workspaceId,
  onChoose,
}: {
  destination: Exclude<ConnectDestination, { kind: "none" }>;
  installationId: number;
  /** The workspace the step's own address names, if it names one. */
  workspaceId?: string;
  onChoose: (workspaceId: string) => void;
}) {
  const compact = useCompact();
  const target = destination.workspace;
  const onWeb = isDesktopShell();
  const write = useWrite(nothingToDo, alwaysSendable);
  const connect = useCallback(
    () =>
      write.run(async () => {
        const connection = await installGitHubApp({
          workspaceId: target.id,
          installationId,
          returnTo: installStepPath(target.id),
        });
        write.leave("install-authorize", connection);
      }),
    [write, target.id, installationId],
  );
  return (
    <>
      {write.error && <InstallRefusal error={write.error} />}
      <DestinationLayout
        choice={
          destination.kind === "fact" ? (
            <Facts ruled rows={[["Workspace", target.name]]} />
          ) : (
            <div className="fo-account-selector">
              <DropdownSelector
                label="Workspace"
                // The trigger carries the chosen workspace, so its composed
                // name would change with the value; naming it once keeps the
                // control the same control however the reader has answered it.
                triggerLabel="Workspace"
                value={target.id}
                options={destination.options.map((workspace) => ({
                  value: workspace.id,
                  label: workspace.name,
                }))}
                variant="field"
                size={compact ? "lg" : "md"}
                searchable
                readOnly={write.working}
                onValueChange={onChoose}
                testID="workspace-select"
              />
            </div>
          )
        }
        control={
          <Action
            label={write.label(
              "Continue on GitHub",
              "Connecting…",
              "Try again",
            )}
            tone="primary"
            icon={onWeb ? "external" : "github"}
            block
            write={write}
            operation="Connecting a GitHub account"
            onPress={() =>
              onWeb
                ? openOnWeb(
                    workspaceId === undefined
                      ? connectInstallationPath(installationId)
                      : installStepPath(workspaceId, installationId),
                  )
                : void connect()
            }
            testID="connect-installation"
          />
        }
      />
    </>
  );
}

/**
 * The install step for an installation that arrived from GitHub with no flow
 * behind it: Configure on GitHub with Redirect on update, or an install
 * started on GitHub. Nothing is connected until the reader chooses the
 * workspace and GitHub proves they administer the account, so the step names
 * no account. A reader with no workspace to put it in makes one first, and
 * the workspace step carries the installation on to this step, which keeps
 * the order Workspace, Install, Repository. The strip claims the workspace
 * only once the reader is known to have one.
 */
export function ConnectScreen({
  user,
  installationId,
  workspaceId,
}: {
  user: User;
  installationId: number;
  workspaceId?: string;
}) {
  const workspaces = useResource(listEveryWorkspace, "connect-workspaces");
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const state = workspaces.state;
  const destination =
    state.status === "ready"
      ? connectDestination(state.value, workspaceId, chosen)
      : undefined;
  const known = destination !== undefined && destination.kind !== "none";
  const identity = { kind: "signed-in", user } as const;
  if (state.status === "loading") return <ConnectWait identity={identity} />;
  return (
    <AccountShell
      {...frame}
      detail={
        destination?.kind === "none"
          ? "Create a workspace to connect this account."
          : undefined
      }
      identity={identity}
      complete={completedSteps({ workspace: known })}
    >
      {state.status === "error" && (
        <>
          <StateMessage
            title="Workspaces couldn’t load"
            error
            details={<ErrorDetails reference={state.error.requestId} />}
          />
          <div className="fo-account-actions">
            <Action
              label="Try again"
              tone="primary"
              icon="retry"
              block
              onPress={workspaces.reload}
              testID="retry-workspaces"
            />
          </div>
        </>
      )}
      {destination?.kind === "none" && (
        <div className="fo-account-actions">
          <Action
            label="Create a workspace"
            tone="primary"
            block
            href={createWorkspaceForPath(installationId)}
            testID="create-workspace-for-installation"
          />
        </div>
      )}
      {destination !== undefined && destination.kind !== "none" && (
        <Destination
          destination={destination}
          installationId={installationId}
          workspaceId={workspaceId}
          onChoose={setChosen}
        />
      )}
    </AccountShell>
  );
}
