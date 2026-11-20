import type { ReactNode } from "react";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { addresses } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  billing,
  failureReference,
  onboarding,
  slugRefusals,
} from "../../../fixtures/product-states";
import { Action, AddressPreview, Pending, StateMessage } from "../page-parts";
import { TextBar } from "../placeholders";
import { projectCreated } from "../setup-destinations";

import { RepositoryField } from "./repository-field";
import type { Accounts } from "./repository-field";

/**
 * What the step runs beside its four states: Create project's write, and the
 * address suggestion while it loads or after it failed.
 */
export type RepositoryActivity =
  "creating" | "suggestion-loading" | "suggestion-error";

/**
 * The third setup step's body: one field over the repositories the
 * workspace's installations return, whatever their count, then the config
 * path, the project slug with the address it gives, and the one action that
 * creates the project. A list that could not be read says so and offers the
 * request again. With nothing to choose, no address can be suggested, so the
 * slug waits empty. While the workspace and its repositories are read,
 * `waiting` is the read's name: the Repository field holds it, every other
 * part draws its waiting form, and Create project's label is known, so it
 * draws itself, disabled. While Create project's write runs, the control
 * carries the wait, the fields hold what was sent, and the form inserts
 * nothing; while the address suggestion loads, the address line names it.
 */
export function RepositoryForm({
  state,
  accounts,
  open = false,
  slugRefused = false,
  activity,
  waiting,
}: {
  state: ScreenState;
  accounts: Accounts;
  open?: boolean;
  slugRefused?: boolean;
  activity?: RepositoryActivity;
  waiting?: ReactNode;
}) {
  if (state === "error")
    return (
      <>
        <StateMessage
          title="Repositories couldn’t load"
          error
          reference={failureReference}
        />
        <div className="fo-account-actions">
          <Action
            label="Try again"
            to="product/account/choose-repository"
            tone="primary"
            icon="retry"
            block
          />
        </div>
      </>
    );
  const waits = waiting !== undefined;
  const creating = activity === "creating";
  const suggestionError = activity === "suggestion-error";
  const empty = state === "empty";
  const slug = empty || suggestionError ? "" : onboarding.projectSlug;
  const create = creating ? (
    <Action label="Creating…" tone="primary" block busy="Creating project" />
  ) : (
    <Action
      label="Create project"
      to={
        slugRefused || suggestionError || waits
          ? undefined
          : projectCreated("available")
      }
      tone="primary"
      block
      disabled={empty || suggestionError || waits}
    />
  );
  return (
    <>
      {waits ? (
        <RepositoryField waiting={waiting} />
      ) : (
        <RepositoryField
          accounts={accounts}
          empty={empty}
          open={open}
          readOnly={creating}
        />
      )}
      <Input
        moklyInstance="choose-repository-config"
        label="Config path"
        name="config-path"
        type="text"
        {...(waits
          ? { waiting: true }
          : { value: onboarding.config, disabled: creating })}
      />
      <Input
        moklyInstance="choose-repository-slug"
        label="Project slug"
        name="project-slug"
        type="identifier"
        {...(waits ? { waiting: true } : { value: slug, disabled: creating })}
        // A registered wrapper refuses an `undefined` prop, so a slug that
        // was not refused leaves the error out.
        {...(slugRefused ? { error: slugRefusals.createProjectTaken } : {})}
      />
      {waits ? (
        <AddressPreview hold={<TextBar width="min(16em, 100%)" />} />
      ) : activity === "suggestion-loading" ? (
        <Pending label="Finding an available address">
          {(name) => <AddressPreview hold={name} />}
        </Pending>
      ) : (
        <AddressPreview
          address={addresses.root + "/" + onboarding.workspaceSlug + "/" + slug}
        />
      )}
      {suggestionError && (
        <StateMessage
          title="Address couldn’t load"
          error
          reference={failureReference}
          action={<Action label="Try again" tone="primary" icon="retry" />}
        />
      )}
      <p className="fo-copy">{billing.publicProjects}</p>
      <div className="fo-account-actions">
        {slugRefused ? (
          <WriteFailure
            moklyInstance="choose-project-slug-failure"
            reference={failureReference}
            control={create}
          />
        ) : (
          create
        )}
      </div>
    </>
  );
}
