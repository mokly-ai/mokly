import type { Viewport } from "@mokly/mokly";

import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, StateMessage } from "../page-parts";
import type { Installation } from "../setup-destinations";
import { SettingsSurface } from "./surface";
import type { AccountsRead } from "./workspace-github";
import { WorkspaceForm } from "./workspace-form";
import { Projects } from "./workspace-projects";
import type { Plan, Role } from "./workspace-projects";

function WorkspacePane({
  state,
  viewport,
  installation = "connected",
  accounts = "read",
  plan = "team",
  role = "owner",
  scopeLoading = false,
  saving = false,
  screen,
}: {
  state: ScreenState;
  viewport: Viewport;
  /** What the workspace's installations add up to, which the fact reports. */
  installation?: Installation;
  /** How far the fact's own read of the installation list has got. */
  accounts?: AccountsRead;
  /** The plan this drawing reads, which every member sees as a fact. */
  plan?: Plan;
  /** The reader's workspace role, which decides the Billing way on. */
  role?: Role;
  /** The pane was asked for by its address while the settings scope loads. */
  scopeLoading?: boolean;
  /** Save's own write is running. */
  saving?: boolean;
  /** A pane drawing one of its own situations names that entry itself. */
  screen?: string;
}) {
  // The pane's layout, which its loaded drawings and its waits all draw.
  const layout = (
    <div className="fo-stack">
      <WorkspaceForm
        installation={installation}
        accounts={state === "loading" ? "loading" : accounts}
        plan={plan}
        role={role}
        scopeLoading={scopeLoading}
        saving={saving}
      />
      <Projects
        state={state}
        installation={installation}
        plan={plan}
        role={role}
        scopeLoading={scopeLoading}
      />
    </div>
  );
  return (
    <SettingsSurface
      pane="workspace"
      state={state}
      viewport={viewport}
      title="Workspace"
      screen={screen}
    >
      {state === "error" ? (
        <StateMessage
          title="Projects couldn’t load"
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              to="product/settings/workspace"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      ) : scopeLoading ? (
        // The scope read has no text place of its own in the pane: each bar
        // stands for a text the workspace supplies, not for the read, so
        // screen readers hear the read alone.
        <Pending label="Loading settings" labelMode="screen-reader-only">
          {layout}
        </Pending>
      ) : (
        layout
      )}
    </SettingsSurface>
  );
}

export function SettingsWorkspaceScreen({ viewport }: { viewport: Viewport }) {
  return <WorkspacePane viewport={viewport} state="default" />;
}

export function SettingsWorkspaceEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <WorkspacePane viewport={viewport} state="empty" plan="free" />;
}

/**
 * The pane while its own reads run: the workspace's name and facts are drawn,
 * the GitHub accounts fact holds its own place, and only the projects list
 * waits, with one placeholder row.
 */
export function SettingsWorkspaceLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <WorkspacePane viewport={viewport} state="loading" />;
}

export function SettingsWorkspaceErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <WorkspacePane viewport={viewport} state="error" />;
}

/** The one connected account suspended on GitHub; the pane names it so. */
export function SettingsWorkspaceSuspendedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      installation="suspended"
      screen="product/settings/workspace/suspended"
    />
  );
}

/** A workspace with no GitHub account, before one is added or after removal. */
export function SettingsWorkspaceAbsentScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      installation="absent"
      screen="product/settings/workspace/absent"
    />
  );
}

/**
 * The fact while its own read of the installation list runs: it holds its
 * place, and the rest of the pane is already there.
 */
export function SettingsWorkspaceAccountsLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      accounts="loading"
      screen="product/settings/workspace/accounts-loading"
    />
  );
}

/** The fact when that read failed: the pane stays, and the fact asks again. */
export function SettingsWorkspaceAccountsUnreadableScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      accounts="failed"
      screen="product/settings/workspace/accounts-unreadable"
    />
  );
}

/**
 * The workspace back on the free plan. Nothing was deleted or made public,
 * so the projects are the ones it had; what changed is that its private ones
 * take no new publication, which the sentence beneath them says and the owner's
 * way on answers.
 */
export function SettingsWorkspacePlanScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      plan="free"
      screen="product/settings/workspace/plan"
    />
  );
}

/** The same downgrade read by someone who must ask an owner to upgrade. */
export function SettingsWorkspacePlanMemberScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      plan="free"
      role="member"
      screen="product/settings/workspace/plan-member"
    />
  );
}

/**
 * The pane asked for by its address while the settings scope loads: the rail
 * draws the sections that the address's scope gives an owner, and the pane
 * draws its own layout with each text that the workspace supplies as a bar.
 */
export function SettingsWorkspaceScopeLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      scopeLoading
      screen="product/settings/workspace/scope-loading"
    />
  );
}

/**
 * Save's own write: Save changes is busy with Saving…, the name it sends stays
 * in its field, and every other control of the pane stays as it was.
 */
export function SettingsWorkspaceSavingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <WorkspacePane
      viewport={viewport}
      state="default"
      saving
      screen="product/settings/workspace/saving"
    />
  );
}
