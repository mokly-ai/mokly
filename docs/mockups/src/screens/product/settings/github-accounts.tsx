import type { RowMenuContent } from "../../../components/responsive-menu";
import { Badge } from "../../../entries/design/badge.mockup";
import { ResponsiveMenu } from "../../../entries/design/responsive-menu.mockup";
import { githubAccounts } from "../../../fixtures/product";
import type { GitHubAccount } from "../../../fixtures/product";
import type { Host } from "../host";
import { setupGlyph } from "../host";
import { Action, ExternalLink, Section } from "../page-parts";
import { NoteRowPlaceholder } from "../placeholder-rows";
import { ControlPlaceholder } from "../placeholders";

import { MenuTriggerPlaceholder } from "./row-placeholders";

/**
 * The GitHub accounts pane's list: the connected accounts under their heading,
 * each row with its three-dot menu, and the section's one control. The pane,
 * its wait and Add GitHub account's write all draw this layout.
 */

/** Owners and admins act on the accounts; every other member reads them. */
export type Reader = "administrator" | "member";

/**
 * The glyph Add GitHub account carries and where it leads. In a browser it
 * leaves for GitHub; in the desktop app's window it opens this pane on the
 * web instead, where the reader adds the account from the browser.
 */
export function addAccount(host: Host) {
  return {
    icon: setupGlyph(host, "start"),
    to: host === "window" ? "product/settings/github" : undefined,
  };
}

/** One account's own actions, which its trigger and its open sheet share. */
export function accountMenu(account: GitHubAccount): RowMenuContent {
  return {
    accessibilityLabel: "Actions for " + account.name,
    title: account.name,
    entries: [
      { id: "manage", label: "Manage on GitHub" },
      { id: "remove", label: "Remove", danger: true },
    ],
  };
}

/**
 * One connected account: its name over what kind of account it is. A
 * connected account needs no state word. A suspension is GitHub's to clear, so
 * a suspended row says so and carries the one link that clears it, in a tab of
 * its own, for every reader. The row's own actions sit behind one three-dot
 * trigger, for the readers who can take them.
 */
function AccountRow({
  account,
  reader,
  suspended,
  menuOpen,
}: {
  account: GitHubAccount;
  reader: Reader;
  suspended: boolean;
  menuOpen: boolean;
}) {
  return (
    <div className="fo-note">
      <div className="fo-note-actions">
        <div className="fo-note-facts">
          <div className="fo-note-head">
            <span className="fo-note-title">{account.name}</span>
            {suspended && <Badge label="Suspended" tone="warning" dot />}
          </div>
          <span className="fo-note-detail">{account.kind}</span>
          {suspended && (
            <ExternalLink to={account.manageUrl} label="Resume on GitHub" />
          )}
        </div>
        {reader === "administrator" && (
          <ResponsiveMenu
            moklyInstance={"github-account-" + account.name}
            {...accountMenu(account)}
            open={menuOpen}
            hostedSheet
          />
        )}
      </div>
    </div>
  );
}

/** The width of Add GitHub account at the section action's size, in px. */
const addAccountWidth = 172;

/**
 * The connected accounts under their heading, with the one control that adds
 * another. While the list is read it keeps this layout: only a list with an
 * account shows the heading and the section's control, so both wait in their
 * own places, and one placeholder row stands for the accounts. Adding leaves
 * for GitHub, so while it runs its control stays busy until the page leaves.
 */
export function ConnectedAccounts({
  reader,
  suspended = false,
  opened,
  waiting = false,
  adding = false,
  host = "browser",
}: {
  reader: Reader;
  suspended?: boolean;
  /** The account whose row menu is open, if one is. */
  opened?: GitHubAccount;
  waiting?: boolean;
  adding?: boolean;
  host?: Host;
}) {
  return (
    <div className="fo-stack">
      <Section
        title={waiting ? { bar: "9em" } : "Connected accounts"}
        action={
          waiting ? (
            <ControlPlaceholder size="sm" width={addAccountWidth} />
          ) : reader === "administrator" ? (
            <Action
              label={adding ? "Adding…" : "Add GitHub account"}
              size="sm"
              {...addAccount(host)}
              busy={adding ? "Adding a GitHub account" : undefined}
            />
          ) : undefined
        }
      >
        {waiting ? (
          <NoteRowPlaceholder end={<MenuTriggerPlaceholder />} />
        ) : (
          githubAccounts.map((account, index) => (
            <AccountRow
              key={account.name}
              account={account}
              reader={reader}
              suspended={suspended && index === 0}
              menuOpen={account === opened}
            />
          ))
        )}
      </Section>
    </div>
  );
}
