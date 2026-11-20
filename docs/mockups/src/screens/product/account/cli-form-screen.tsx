import type { ReactNode } from "react";

import { MockLink } from "@mokly/mokly";
import type { Viewport } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { addresses } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  billing,
  causes,
  failureReference,
  onboarding,
  placeholders,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { Action, AddressPreview, BackLink } from "../page-parts";
import { projectCreated, setupStep } from "../setup-destinations";
import type { Installation } from "../setup-destinations";

import { AccountShell } from "./account-shell";
import type { SetupStep } from "./setup-progress";

/**
 * A project with no repository the App reads. The reader names the repository
 * as the Mokly CLI identifies it, from any Git host, and the project publishes
 * with the CLI, by hand or from CI. Nothing is listed from GitHub, so there is
 * nothing to wait for but the workspace and the project being created, and
 * the project it makes cannot build, so it lands where nothing is publishing
 * yet.
 *
 * Each drawing names its workspace's installation. The way back is the step
 * that offered the form: the repository step for a workspace with a connected
 * account, the install step otherwise, whose strip claims no installation.
 * The untouched form is drawn for a workspace with nothing installed; every
 * other drawing is the workspace with its two accounts.
 *
 * A repository that already has a project is refused with the way to that
 * project. Sending the same repository again would be refused the same way,
 * so Create project keeps its own label and the reference stays beneath it.
 * While the project is created, the control says so with the busy spinner and
 * screen readers hear the operation, so nothing is said twice and nothing is
 * inserted. While the workspace is read, the form draws its waiting form, and
 * the address, which the workspace decides, names the read.
 */
function CliFormPage({
  state,
  installation,
}: {
  state: ScreenState | "workspace-loading";
  installation: Installation;
}) {
  const untouched = state === "empty";
  const creating = state === "loading";
  const slug = untouched ? "" : onboarding.cliProjectSlug;
  const create = creating ? (
    <Action label="Creating…" tone="primary" block busy="Creating project" />
  ) : (
    <Action
      label="Create project"
      to={state === "default" ? projectCreated("unavailable") : undefined}
      tone="primary"
      block
      disabled={untouched || state === "workspace-loading"}
    />
  );
  const form = (waiting?: ReactNode) => {
    const waits = waiting !== undefined;
    // A registered wrapper refuses an `undefined` prop, so each field names
    // its value or its waiting form only where it has one.
    const field = (value: string) =>
      waits ? { waiting: true } : { value, disabled: creating };
    return (
      <>
        <Input
          moklyInstance="cli-repository"
          label="Repository"
          name="repository"
          type="text"
          {...field(untouched ? "" : onboarding.cliRepository)}
          {...(waits ? {} : { placeholder: placeholders.repository })}
        />
        <Input
          moklyInstance="cli-config"
          label="Config path"
          name="config-path"
          type="text"
          {...field(onboarding.config)}
        />
        <Input
          moklyInstance="cli-slug"
          label="Project slug"
          name="project-slug"
          type="identifier"
          {...field(slug)}
        />
        {waits ? (
          <AddressPreview hold={waiting} />
        ) : (
          <AddressPreview
            address={
              addresses.root + "/" + onboarding.workspaceSlug + "/" + slug
            }
          />
        )}
        <p className="fo-copy">{billing.publicProjects}</p>
        {state === "error" && (
          <p className="fo-copy" role="alert">
            {causes.duplicate}{" "}
            <MockLink to="product/viewer/standalone">Open it</MockLink>.
          </p>
        )}
        <div className="fo-account-actions">
          {state === "error" ? (
            <WriteFailure
              moklyInstance="cli-create-failure"
              reference={failureReference}
              control={create}
            />
          ) : (
            create
          )}
        </div>
        <BackLink to={setupStep(installation)} />
      </>
    );
  };
  const complete: readonly SetupStep[] =
    installation === "connected" ? [1, 2] : [1];
  const frame = {
    id: stateScreenPath("product/account/choose-repository/cli", state),
    title: "Publish with the CLI",
    identity: { kind: "signed-in" },
    step: 3,
    complete,
  } as const;
  return state === "workspace-loading" ? (
    <AccountShell {...frame} wait="Loading your workspace">
      {(name) => form(name)}
    </AccountShell>
  ) : (
    <AccountShell {...frame}>{form()}</AccountShell>
  );
}

export function CliFormScreen(_props: { viewport: Viewport }) {
  return <CliFormPage state="default" installation="connected" />;
}

export function CliFormEmptyScreen(_props: { viewport: Viewport }) {
  return <CliFormPage state="empty" installation="absent" />;
}

/** The project in creation: the form, with Create project busy. */
export function CliFormLoadingScreen(_props: { viewport: Viewport }) {
  return <CliFormPage state="loading" installation="connected" />;
}

export function CliFormErrorScreen(_props: { viewport: Viewport }) {
  return <CliFormPage state="error" installation="connected" />;
}

/**
 * The workspace read: the form in waiting form, for the workspace with its
 * two accounts, which is the form's most common way in.
 */
export function CliFormWorkspaceLoadingScreen(_props: { viewport: Viewport }) {
  return <CliFormPage state="workspace-loading" installation="connected" />;
}
