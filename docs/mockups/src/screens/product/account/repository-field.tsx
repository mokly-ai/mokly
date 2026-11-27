import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";

import { OptionsList } from "../../../entries/design/options-list.mockup";
import { Selector } from "../../../entries/design/selector.mockup";
import { githubAccounts, sample } from "../../../fixtures/product";
import type { GitHubAccount } from "../../../fixtures/product";

/** How many GitHub accounts the workspace connects: the select's one question. */
export type Accounts = "several" | "one";

/** One account's repositories as the select lists them. */
function choices(account: GitHubAccount) {
  return account.repositories.map((repository) => ({
    value: repository.name,
    label: repository.name,
    detail: repository.visibility,
  }));
}

/** One section per account, titled with the account name. */
const sections = githubAccounts.map((account) => ({
  title: account.name,
  options: choices(account),
}));

/**
 * The line beneath the field, which is where the list is changed: what the App
 * reads is decided on GitHub, one account at a time. However many accounts the
 * workspace connects, the link opens the GitHub accounts pane, which both adds
 * another account and keeps each account's own way to GitHub. The link needs
 * nothing from the read, so a wait draws it too.
 */
function ManageAccess() {
  return (
    <p className="fo-copy fo-selector-note">
      Don’t see it?{" "}
      <MockLink to="product/settings/github" className="fo-site-link">
        <span>Manage repository access</span>
      </MockLink>
    </p>
  );
}

/**
 * The open list, drawn where the live select opens it: the package's surface
 * beneath the field, the search field first and then one titled section per
 * account, with the chosen repository marked.
 */
function OpenList() {
  return (
    <OptionsList
      moklyInstance="repository-options"
      label={"Repository, " + sample.repository}
      selected={sample.repository}
      options={[]}
      search="Search options"
      sections={sections.map((section) => ({
        title: section.title,
        options: section.options.map((option) => ({
          id: option.value,
          label: option.label,
          detail: option.detail,
        })),
      }))}
      anchored
    />
  );
}

/**
 * The one field for the repository and the one line beneath it. A workspace
 * with several accounts groups the select by account; one account keeps it
 * flat. With nothing to choose the field is disabled over its placeholder and
 * the line is the only way on; while the project is created it is read only
 * over the chosen repository. While the repositories are read, the field
 * draws its waiting form, holding `waiting`, the read's name.
 */
export function RepositoryField(
  props:
    | { accounts: Accounts; empty: boolean; open?: boolean; readOnly?: boolean }
    | { waiting: ReactNode },
) {
  if ("waiting" in props)
    return (
      <div className="fo-account-selector">
        <Selector
          moklyInstance="repository-select"
          label="Repository"
          waiting
          options={[]}
          hold={props.waiting}
        />
        <ManageAccess />
      </div>
    );
  const { accounts, empty, open = false, readOnly = false } = props;
  const grouped = accounts === "several" && !empty;
  return (
    <div className="fo-account-selector">
      <div className="fo-selector-anchor">
        <Selector
          moklyInstance="repository-select"
          label="Repository"
          // The registered Selector refuses an `undefined` prop, so the field
          // names a value, a placeholder or sections only where it has one.
          {...(empty
            ? { placeholder: "No repositories yet" }
            : { value: sample.repository })}
          disabled={empty || readOnly}
          options={empty || grouped ? [] : choices(githubAccounts[0])}
          {...(grouped ? { sections } : {})}
        />
        {open && <OpenList />}
      </div>
      <ManageAccess />
    </div>
  );
}
