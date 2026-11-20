import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";

import { unexpectedError } from "../../api/errors";
import type { User, Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { AppLink } from "../../components/app-link";
import { BackLink, Pending } from "../../components/page-parts";
import { ControlPlaceholder } from "../../components/placeholders";
import { installGitHubApp } from "../../data/auth";
import { listInstallations } from "../../data/installations";
import {
  useInvalidateResources,
  workspaceResourceScope,
} from "../../data/resource-invalidation";
import { useResource } from "../../data/use-resource";
import { isDesktopShell } from "../../navigation/desktop-shell";
import { storeGitHubFlow } from "../../navigation/github-flow";
import {
  createWorkspacePath,
  installStepPath,
  workspaceCliProjectPath,
  workspaceNewProjectPath,
} from "../../navigation/paths";
import { currentReturnTo } from "../../navigation/return-to";
import { useShellFocus } from "../../navigation/shell-focus";
import { openOnWeb } from "../../navigation/web-setup";
import { alwaysSendable, nothingToDo, useWrite } from "../../settings/write";

import { AccountShell } from "./account-shell";
import type { ShellWait, WaitingIdentity } from "./account-shell";
import { InstallRefusal } from "./install-refusal";
import { Suspension } from "./install-suspension";
import { completedSteps } from "./setup-progress";

/** The frame of the second setup step, which every reader's form shares. */
const frame = {
  screen: "account-install-app",
  documentTitle: "Install",
  step: 2,
} as const;

/**
 * The line under the panel that leads to the CLI form: a project needs no
 * repository the App can read, because the Mokly CLI publishes any
 * repository, by hand or from CI. Every reader who can create a project gets
 * it, so a step they cannot pass is never a dead end. While the workspace is
 * read, the form's address is not known, so the line draws its words as text
 * with no link, in the box the link takes.
 */
function cliLine(workspace?: Workspace) {
  const words = "Publish with the CLI instead";
  return (
    <p className="fo-account-switch">
      {workspace ? (
        <AppLink href={workspaceCliProjectPath(workspace.slug)}>
          {words}
        </AppLink>
      ) : (
        <span className="fo-account-switch-text">{words}</span>
      )}
    </p>
  );
}

/** The step's one control and its way back, under whatever the step says. */
function InstallControls({ control }: { control: ReactNode }) {
  return (
    <>
      <div className="fo-account-actions">{control}</div>
      <BackLink href={createWorkspacePath} />
    </>
  );
}

/**
 * The owner's and the admin's step, loaded or waiting: the title, the line
 * under it, the body and the line to the CLI form, over the strip at the
 * second step. While a read runs, `wait` makes the panel the waiting region,
 * and the line under the title names the read.
 */
function InstallLayout({
  identity,
  installed,
  below,
  wait,
  children,
}: {
  identity: WaitingIdentity;
  installed: boolean;
  below?: ReactNode;
  wait?: ShellWait;
  children: ReactNode;
}) {
  const shell = {
    ...frame,
    title: "Install the Mokly app",
    identity,
    complete: completedSteps({ workspace: true, installed }),
    below,
  };
  return wait ? (
    <AccountShell {...shell} wait={wait} detail={(name) => name}>
      {children}
    </AccountShell>
  ) : (
    <AccountShell {...shell} detail="Choose the repositories Mokly can read.">
      {children}
    </AccountShell>
  );
}

/**
 * The step while the session or the workspace is read, and while a connected
 * workspace is handed on to the repository step: the owner's and the admin's
 * form, because the person who creates a workspace owns it. The reader's role
 * decides whether the control is there at all, so it is a placeholder in its
 * own box, and the line to the CLI form is text.
 */
export function InstallWait({
  identity,
  installed = false,
}: {
  identity: WaitingIdentity;
  installed?: boolean;
}) {
  return (
    <InstallLayout
      identity={identity}
      installed={installed}
      below={cliLine()}
      wait={(panel) => (
        <Pending label="Loading your workspace">{panel}</Pending>
      )}
    >
      <InstallControls control={<ControlPlaceholder />} />
    </InstallLayout>
  );
}

/**
 * The step for an owner or admin, the readers who can install the App: one
 * control, and with a suspended binding the fact that says so. What holds the
 * write is one `useWrite`, so a second press while the first is in flight
 * sends nothing. While the write runs, the step keeps its form: Install on
 * GitHub stays, busy with its working word until the page leaves for GitHub,
 * and Back and the line to the CLI form stay beside it. A reader who follows
 * either stays where they went, because the write leaves only from this step.
 * In the desktop app's window the control opens this step on the web instead,
 * where the reader installs the App from the browser, so it carries the
 * external glyph there.
 */
function InstallAction({
  user,
  workspace,
}: {
  user: User;
  workspace: Workspace;
}) {
  const suspended = workspace.githubInstallationState === "suspended";
  const installations = useResource(
    () => listInstallations(workspace.id),
    `install-step:${workspace.id}`,
    suspended,
    [workspaceResourceScope(workspace.id)],
  );
  const onWeb = isDesktopShell();
  const write = useWrite(nothingToDo, alwaysSendable);
  const install = useCallback(
    () =>
      write.run(async () => {
        const connection = await installGitHubApp({
          workspaceId: workspace.id,
          returnTo: currentReturnTo(),
        });
        if (!storeGitHubFlow("install-setup", connection)) {
          throw unexpectedError();
        }
        write.leave(connection.authorizeUrl);
      }),
    [write, workspace.id],
  );
  const list = installations.state;
  // The link is the only part of the step the list supplies, so only the fact
  // waits for it, and a failed read leaves the suspension and the action.
  const suspension = <Suspension list={list} onRetry={installations.reload} />;
  return (
    <InstallLayout
      identity={{ kind: "signed-in", user }}
      installed={false}
      below={cliLine(workspace)}
    >
      {write.error && <InstallRefusal error={write.error} />}
      {suspended &&
        (list.status === "loading" ? (
          <Pending
            label="Loading GitHub installation"
            labelMode="screen-reader-only"
          >
            {suspension}
          </Pending>
        ) : (
          suspension
        ))}
      <InstallControls
        control={
          <Action
            label={write.label("Install on GitHub", "Installing…", "Try again")}
            tone="primary"
            icon={onWeb ? "external" : "github"}
            block
            write={write}
            operation="Installing the Mokly app"
            onPress={() =>
              onWeb ? openOnWeb(installStepPath(workspace.id)) : void install()
            }
            testID="install-app"
          />
        }
      />
    </InstallLayout>
  );
}

/**
 * The second setup step, drawn for the reader's role. An owner or admin
 * installs the App. A member, who can create projects but cannot install it,
 * is told who can and keeps the way to the CLI form. A reviewer creates no
 * project, so the step says the workspace has none and who makes the first.
 * Member and reviewer keep the strip and the way back, so the page is not a
 * dead end. A workspace with a connected account never sees the step: the
 * reader is handed on to the repository step, which is the only state this
 * screen does not draw.
 */
export function InstallScreen({
  user,
  workspace,
}: {
  user: User;
  workspace: Workspace;
}) {
  const router = useRouter();
  const invalidate = useInvalidateResources();
  const bound = workspace.githubInstallationState === "connected";

  useEffect(() => {
    if (bound) router.replace(workspaceNewProjectPath(workspace.slug));
  }, [bound, workspace.slug, router]);

  // In the desktop app's window the App is installed on the web, so the step
  // reads the workspace and its installations again when the window gets
  // focus back, and a workspace connected meanwhile moves on.
  const reread = useCallback(
    () => invalidate([workspaceResourceScope(workspace.id)]),
    [invalidate, workspace.id],
  );
  useShellFocus(reread);

  const identity = { kind: "signed-in", user } as const;
  // On its way to the repository step, so the step it is leaving draws its
  // wait rather than an action the reader would see flash.
  if (bound) return <InstallWait identity={identity} installed />;
  const shell = {
    ...frame,
    identity,
    complete: completedSteps({ workspace: true, installed: false }),
  };
  if (workspace.role === "reviewer") {
    return (
      <AccountShell
        {...shell}
        title="No projects yet"
        detail="Ask an owner or admin to create the first project."
      >
        <BackLink href={createWorkspacePath} />
      </AccountShell>
    );
  }
  if (workspace.role === "member") {
    return (
      <AccountShell
        {...shell}
        title="Install the Mokly app"
        detail="Ask an owner or admin to install it."
        below={cliLine(workspace)}
      >
        <BackLink href={createWorkspacePath} />
      </AccountShell>
    );
  }
  return <InstallAction user={user} workspace={workspace} />;
}
