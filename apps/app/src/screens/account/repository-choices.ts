import type {
  DropdownSelectorOption,
  DropdownSelectorSection,
} from "@firna/ui/dropdown";

import type { Installation, Repository } from "../../api/types";
import { listInstallations, listRepositories } from "../../data/installations";

/** One connected account and the repositories it lets the App read. */
export interface AccountRepositories {
  installation: Installation;
  repositories: readonly Repository[];
}

/** What the repository step offers for one workspace. */
export interface RepositoryChoices {
  /**
   * Every account the workspace binds, suspended ones included, in the
   * list's order: the manage sentence points at them.
   */
  installations: readonly Installation[];
  /** The connected accounts, whose repositories the select offers. */
  accounts: readonly AccountRepositories[];
}

/**
 * Read one workspace's accounts and the repositories of each connected one.
 * The list is filtered to the open workspace, because the API refuses a
 * repository from another workspace's installation; a suspended account's
 * repositories are not offered, because nothing can be made from them.
 */
export async function loadRepositoryChoices(
  workspaceId: string,
): Promise<RepositoryChoices> {
  const installations = await listInstallations(workspaceId);
  const accounts = await Promise.all(
    installations
      .filter((installation) => installation.state === "connected")
      .map(async (installation) => ({
        installation,
        repositories: await listRepositories(installation.id),
      })),
  );
  return { installations, accounts };
}

function option(repository: Repository): DropdownSelectorOption {
  return {
    value: repository.id,
    label: repository.fullName,
    secondary: repository.private ? "Private" : "Public",
  };
}

/**
 * The select's choices. One connected account keeps the list flat; several
 * group it into one section per account, titled with the account's name, so
 * two repositories with the same name stay apart. An account that grants
 * nothing has no section, because a title over nothing offers nothing.
 */
export function repositoryOptions(accounts: readonly AccountRepositories[]): {
  options: DropdownSelectorOption[];
  sections?: DropdownSelectorSection[];
} {
  if (accounts.length <= 1) {
    return { options: accounts[0]?.repositories.map(option) ?? [] };
  }
  return {
    options: [],
    sections: accounts
      .filter((account) => account.repositories.length > 0)
      .map((account) => ({
        title: account.installation.account,
        options: account.repositories.map(option),
      })),
  };
}

/** The repository the reader chose, from whichever account holds it. */
export function chosenRepository(
  accounts: readonly AccountRepositories[],
  repositoryId: string,
): Repository | undefined {
  for (const account of accounts) {
    const found = account.repositories.find(
      (repository) => repository.id === repositoryId,
    );
    if (found) return found;
  }
  return undefined;
}

/**
 * Where "Manage repository access" leads. What the App reads is decided on
 * GitHub, so with one account the link is that installation's own page
 * there. Several accounts have no single page, so the link opens the GitHub
 * accounts pane, which holds one manage link for each.
 */
export type ManageDestination =
  { kind: "github"; url: string } | { kind: "pane" };

export function manageDestination(
  installations: readonly Installation[],
): ManageDestination | undefined {
  if (installations.length > 1) return { kind: "pane" };
  const [only] = installations;
  return only === undefined
    ? undefined
    : { kind: "github", url: only.manageUrl };
}
