import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { accountKindLabels } from "../../api/labels";
import type { Installation, Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { StatusBadge } from "../../components/controls";
import {
  ExternalLink,
  Pending,
  Section,
  StateMessage,
} from "../../components/page-parts";
import type { SectionTitle } from "../../components/page-parts";
import { NoteRowPlaceholder } from "../../components/placeholder-rows";
import { ControlPlaceholder } from "../../components/placeholders";
import { PaneResource } from "../../components/resource-state";
import { installGitHubApp } from "../../data/auth";
import { listInstallations } from "../../data/installations";
import {
  useInvalidateResources,
  workspaceResourceScope,
} from "../../data/resource-invalidation";
import { useResource } from "../../data/use-resource";
import { isDesktopShell } from "../../navigation/desktop-shell";
import { settingsPath } from "../../navigation/paths";
import { useShellFocus } from "../../navigation/shell-focus";
import { openBeside, openOnWeb } from "../../navigation/web-setup";
import { useSettings } from "../context";
import { RowMenu } from "../row-menu";
import { alwaysSendable, nothingToDo, useWrite } from "../write";

import { RemoveInstallation } from "./github-remove";
import { MenuTriggerPlaceholder } from "./row-placeholders";

/**
 * One account the workspace connects: its name over what kind of account it
 * is. A connected account needs no state word. A suspension is GitHub's to
 * clear, so a suspended row says so and carries the one link that clears it,
 * for every reader. The row's own actions sit behind one three-dot trigger,
 * for the readers who can take them.
 */
function AccountRow({
  installation,
  administers,
  onRemoved,
}: {
  installation: Installation;
  administers: boolean;
  onRemoved: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const close = useCallback(() => setRemoving(false), []);
  const suspended = installation.state === "suspended";
  return (
    <div className="fo-note" data-testid={"github-account-" + installation.id}>
      <div className="fo-note-actions">
        <div className="fo-note-facts">
          <div className="fo-note-head">
            <span className="fo-note-title">{installation.account}</span>
            {suspended && <StatusBadge label="Suspended" tone="warning" dot />}
          </div>
          <span className="fo-note-detail">
            {accountKindLabels[installation.accountKind]}
          </span>
          {suspended && (
            <ExternalLink
              to={installation.manageUrl}
              label="Resume on GitHub"
              newTab
            />
          )}
        </div>
        {administers && (
          <RowMenu
            label={"Actions for " + installation.account}
            title={installation.account}
            testID={"github-account-actions-" + installation.id}
            entries={[
              {
                id: "manage",
                label: "Manage on GitHub",
                onPress: () => openBeside(installation.manageUrl),
                testID: "manage-github-account-" + installation.id,
              },
              {
                id: "remove",
                label: "Remove",
                danger: true,
                onPress: () => setRemoving(true),
                testID: "remove-github-account-" + installation.id,
              },
            ]}
          />
        )}
      </div>
      {removing && (
        <RemoveInstallation
          installation={installation}
          onClose={close}
          onRemoved={onRemoved}
        />
      )}
    </div>
  );
}

/** The width in px of Add GitHub account at the section action's size. */
const addAccountWidth = 172;

/**
 * The connected accounts under their heading, with the section's one control,
 * which the pane and its wait both draw.
 */
function ConnectedAccounts({
  title,
  action,
  children,
}: {
  title: SectionTitle;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fo-stack">
      <Section title={title} action={action}>
        {children}
      </Section>
    </div>
  );
}

/**
 * The accounts while they are read. Only a list with an account shows the
 * heading and the section's control, so both wait in their own places, and
 * one placeholder row stands for the accounts. A reader who does not
 * administer the workspace gets neither the control nor a row menu, so their
 * wait draws neither. A list has no place whose text the read decides, so the
 * read is named for screen readers only.
 */
export function GitHubWait({ administers = true }: { administers?: boolean }) {
  return (
    <ConnectedAccounts
      title={{ bar: "9em" }}
      action={
        administers ? (
          <ControlPlaceholder size="sm" width={addAccountWidth} />
        ) : undefined
      }
    >
      <NoteRowPlaceholder
        end={administers ? <MenuTriggerPlaceholder /> : undefined}
      />
    </ConnectedAccounts>
  );
}

/**
 * Every GitHub account the workspace connects, and the one control that adds
 * another. Adding leaves for GitHub and returns to this pane's own route, so
 * it is a way out of settings and asks about unsaved work first; removing is
 * asked in a modal over the row it concerns, so the list keeps its place.
 * Owners and admins act on the accounts; every other member reads them.
 *
 * In the desktop app's window, adding opens this pane on the web instead,
 * where the reader adds the account from the browser, so the window stays
 * where it is; the window reads the accounts again when it gets focus back.
 */
export function GitHubPane({ workspace }: { workspace: Workspace }) {
  const { leaveBy } = useSettings();
  const invalidate = useInvalidateResources();
  const scope = workspaceResourceScope(workspace.id);
  const installations = useResource(
    () => listInstallations(workspace.id),
    "installations:" + workspace.id,
    true,
    [scope],
  );
  // The workspace's installation state is read beneath the dialog too — the
  // repository step hands a workspace with nothing connected back to the
  // install step — so a removal refreshes every read of this workspace, and so
  // does the window getting focus back from setup on the web.
  const reread = useCallback(() => invalidate([scope]), [invalidate, scope]);
  useShellFocus(reread);
  const onWeb = isDesktopShell();
  const adding = useWrite(nothingToDo, alwaysSendable);
  const add = useCallback(
    () =>
      adding.run(async () => {
        const connection = await installGitHubApp({
          workspaceId: workspace.id,
          returnTo: settingsPath({
            pane: "github",
            workspaceSlug: workspace.slug,
          }),
        });
        adding.leave("install-setup", connection);
      }),
    [adding, workspace.id, workspace.slug],
  );
  const administers = workspace.role === "owner" || workspace.role === "admin";
  const addAccount = (tone: "primary" | "secondary", size: "sm" | "md") =>
    administers
      ? adding.around(
          <Action
            label={adding.label("Add GitHub account", "Adding…")}
            tone={tone}
            size={size}
            icon={onWeb ? "external" : "start"}
            write={adding}
            operation="Adding a GitHub account"
            onPress={() =>
              onWeb
                ? openOnWeb(
                    settingsPath({
                      pane: "github",
                      workspaceSlug: workspace.slug,
                    }),
                  )
                : leaveBy(() => void add())
            }
            testID="add-github-account"
          />,
        )
      : undefined;
  return (
    <PaneResource
      resource={installations.state}
      waiting={
        <Pending label="Loading GitHub accounts" labelMode="screen-reader-only">
          <GitHubWait administers={administers} />
        </Pending>
      }
      failure="GitHub accounts couldn’t load"
      onRetry={installations.reload}
    >
      {(items) =>
        items.length === 0 ? (
          <StateMessage
            title="No GitHub accounts yet"
            icon="github"
            action={addAccount("primary", "md")}
          />
        ) : (
          <ConnectedAccounts
            title="Connected accounts"
            action={addAccount("secondary", "sm")}
          >
            {items.map((installation) => (
              <AccountRow
                key={installation.id}
                installation={installation}
                administers={administers}
                onRemoved={reread}
              />
            ))}
          </ConnectedAccounts>
        )
      }
    </PaneResource>
  );
}
