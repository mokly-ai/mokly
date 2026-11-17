import type { ReactNode } from "react";

import { publicOnFree } from "../../api/labels";
import { BackLink } from "../../components/page-parts";
import { AccountShell } from "./account-shell";
import type { ShellWait, WaitingIdentity } from "./account-shell";
import { completedSteps } from "./setup-progress";

/** The form's two text fields, named once for the form and for its wait. */
export const repositoryField = {
  label: "Repository",
  name: "repository",
  type: "text",
} as const;
export const configPathField = {
  label: "Config path",
  name: "config-path",
  type: "text",
} as const;

/**
 * What the form's panel holds: the form once its workspace is read, or while
 * it is read, the waiting region and a form that holds the read's name.
 */
type CliBody =
  | { wait?: undefined; children: ReactNode }
  | { wait: ShellWait; children: (name: ReactNode) => ReactNode };

/**
 * The CLI form's panel, loaded or waiting: the title and the form over the
 * strip at the third step, which credits the install step only for a
 * workspace with a connected account.
 */
export function CliFormStep({
  identity,
  connected,
  ...body
}: { identity: WaitingIdentity; connected: boolean } & CliBody) {
  return (
    <AccountShell
      screen="account-cli-form"
      title="Publish with the CLI"
      identity={identity}
      step={3}
      complete={completedSteps({ workspace: true, installed: connected })}
      {...body}
    />
  );
}

/**
 * The form, loaded or waiting: the repository, the config path, the
 * project's address, what a free workspace's project will be, Create project
 * and the way back. The screen passes its live parts, and its wait passes
 * their waiting forms, so the wait cannot drift from the form.
 */
export function CliForm({
  repository,
  configPath,
  address,
  free,
  submit,
  back,
}: {
  repository: ReactNode;
  configPath: ReactNode;
  address: ReactNode;
  free: boolean;
  submit: ReactNode;
  back: string;
}) {
  return (
    <>
      {repository}
      {configPath}
      {address}
      {free && <p className="fo-copy">{publicOnFree}</p>}
      {submit}
      <BackLink href={back} />
    </>
  );
}
