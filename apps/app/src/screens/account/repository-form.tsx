import type { ReactNode } from "react";

import { publicOnFree } from "../../api/labels";
import { AccountShell } from "./account-shell";
import type { ShellWait, WaitingIdentity } from "./account-shell";
import { completedSteps } from "./setup-progress";

/**
 * What the step's panel holds: its body once the step is read, or while a
 * read runs, the waiting region and a body that holds the read's name.
 */
type RepositoryBody =
  | { wait?: undefined; children: ReactNode }
  | { wait: ShellWait; children: (name: ReactNode) => ReactNode };

/**
 * The repository step's panel, loaded or waiting: the title, the body and
 * the line under the panel, over the strip at the third step. `installed`
 * says whether the strip credits the install step.
 */
export function RepositoryStep({
  identity,
  installed,
  below,
  ...body
}: {
  identity: WaitingIdentity;
  installed: boolean;
  below?: ReactNode;
} & RepositoryBody) {
  return (
    <AccountShell
      screen="account-choose-repository"
      title="Choose a repository"
      identity={identity}
      step={3}
      complete={completedSteps({ workspace: true, installed })}
      below={below}
      {...body}
    />
  );
}

/**
 * The step's form, loaded or waiting: the repository, the config path, the
 * project's address, what a free workspace's project will be, and Create
 * project. The screen passes its live parts, and its wait passes their
 * waiting forms, so the wait cannot drift from the form. A free workspace's
 * projects are created public, so the step that creates one says what it
 * will be.
 */
export function RepositoryForm({
  repository,
  configPath,
  address,
  free,
  submit,
}: {
  repository: ReactNode;
  configPath: ReactNode;
  address: ReactNode;
  free: boolean;
  submit: ReactNode;
}) {
  return (
    <>
      {repository}
      {configPath}
      {address}
      {free && <p className="fo-copy">{publicOnFree}</p>}
      {submit}
    </>
  );
}
