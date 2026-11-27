import type { Workspace } from "../../api/types";

/**
 * Where the connect situation puts the arriving account: nowhere yet, for a
 * reader who administers no workspace; one workspace stated as a fact, when
 * the address names one the reader administers; or a choice over every
 * workspace the reader administers, which starts on the first of them. The
 * choice stands for one workspace too, because its last entry makes a new
 * workspace for the account instead.
 */
export type ConnectDestination =
  | { kind: "none" }
  | { kind: "fact"; workspace: Workspace }
  | { kind: "select"; workspace: Workspace; options: readonly Workspace[] };

/** Only a workspace the reader administers can take a GitHub account. */
export function administers(workspace: Workspace): boolean {
  return workspace.role === "owner" || workspace.role === "admin";
}

/**
 * Choose the destination from the reader's workspaces, in the API's order,
 * the workspace the address names, and the one the reader chose in the
 * select. A named workspace the reader does not administer cannot take the
 * account, so it is read as no name rather than offered.
 */
export function connectDestination(
  workspaces: readonly Workspace[],
  named: string | undefined,
  chosen: string | undefined,
): ConnectDestination {
  const options = workspaces.filter(administers);
  const fixed = options.find((workspace) => workspace.id === named);
  if (fixed) return { kind: "fact", workspace: fixed };
  const [first] = options;
  if (first === undefined) return { kind: "none" };
  const selected =
    options.find((workspace) => workspace.id === chosen) ?? first;
  return { kind: "select", workspace: selected, options };
}
