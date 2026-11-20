import { Input } from "../../../entries/design/input.mockup";
import { sample, workspace } from "../../../fixtures/product";
import { billing } from "../../../fixtures/product-states";
import { Action, Facts } from "../page-parts";
import { ControlPlaceholder, factPlaceholder, TextBar } from "../placeholders";
import type { Installation } from "../setup-destinations";

import { GitHubAccounts, GitHubAccountsWait } from "./workspace-github";
import type { AccountsRead } from "./workspace-github";
import type { Plan, Role } from "./workspace-projects";

/** The widths of Change and Save changes, whose presence the role decides, in px. */
const changeWidth = 72;
const saveWidth = 123;

/**
 * The Workspace pane's first section: the workspace's name, its facts and
 * Save. While the settings scope loads, every text that the workspace supplies
 * waits as a bar in its own line box and the name waits in its frame. Change,
 * Manage and Save show for the readers who administer the workspace, the most
 * common form, so each waits as a placeholder in its own box. While Save's own
 * write runs, Save is busy and the name it sends stays in its field.
 */
export function WorkspaceForm({
  installation,
  accounts,
  plan,
  role,
  scopeLoading,
  saving,
}: {
  /** What the workspace's installations add up to, which the fact reports. */
  installation: Installation;
  /** How far the fact's own read of the installation list has got. */
  accounts: AccountsRead;
  /** The plan this drawing reads, which every member sees as a fact. */
  plan: Plan;
  /** The reader's workspace role, which decides who gets Manage. */
  role: Role;
  /** The pane was asked for by its address while the settings scope loads. */
  scopeLoading: boolean;
  /** Save's own write is running. */
  saving: boolean;
}) {
  return (
    <section className="fo-section fo-section-flush">
      <div className="fo-form">
        <Input
          label="Workspace name"
          name="workspace-name"
          type="text"
          {...(scopeLoading
            ? { waiting: true }
            : {
                value: sample.workspace,
                ...(saving ? { disabled: true } : {}),
              })}
        />
        <Facts
          rows={
            scopeLoading
              ? [
                  factPlaceholder("Plan", "3em"),
                  [
                    "Slug",
                    <span className="review-inline" key="workspace-slug">
                      <code>
                        <TextBar width="7em" />
                      </code>
                      <ControlPlaceholder size="sm" width={changeWidth} />
                    </span>,
                  ],
                  [
                    "GitHub accounts",
                    <GitHubAccountsWait key="github-accounts" />,
                  ],
                ]
              : [
                  // Every member reads the plan here, including the ones the
                  // Billing pane is not shown to.
                  ["Plan", plan === "free" ? billing.free : billing.plan],
                  [
                    "Slug",
                    <span className="review-inline" key="workspace-slug">
                      <code>{workspace.slug}</code>
                      <Action
                        label="Change"
                        to="product/settings/workspace/slug"
                        tone="quiet"
                        size="sm"
                      />
                    </span>,
                  ],
                  [
                    "GitHub accounts",
                    // The pane reads the installation list beside its
                    // projects, so while the pane loads, the fact holds its
                    // own place too.
                    <GitHubAccounts
                      key="github-accounts"
                      installation={installation}
                      role={role}
                      read={accounts}
                    />,
                  ],
                ]
          }
        />
        <div className="review-inline">
          {scopeLoading ? (
            <ControlPlaceholder size="md" width={saveWidth} />
          ) : (
            <Action
              label={saving ? "Saving…" : "Save changes"}
              tone="primary"
              size="md"
              busy={saving ? "Saving settings" : undefined}
            />
          )}
        </div>
      </div>
    </section>
  );
}
