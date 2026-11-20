import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import type { User, Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { AppLink } from "../../components/app-link";
import { ErrorDetails } from "../../components/error-details";
import { Field } from "../../components/field";
import { formFailure, slugFieldOwners } from "../../components/form-failure";
import { Pending, StateMessage } from "../../components/page-parts";
import { workspaceResourceScope } from "../../data/resource-invalidation";
import { isRefreshing, useResource } from "../../data/use-resource";
import { replaceAddress, useAddressSearch } from "../../navigation/address";
import {
  installStepPath,
  workspaceCliProjectPath,
} from "../../navigation/paths";
import { carrySettings } from "../../settings/routes";

import type { WaitingIdentity } from "./account-shell";
import { ExistingProject } from "./existing-project";
import { ProjectAddress } from "./project-address";
import { chosenRepository, loadRepositoryChoices } from "./repository-choices";
import { RepositoryField } from "./repository-field";
import { RepositoryForm, RepositoryStep } from "./repository-form";
import { useRepositoryProject } from "./repository-project";

/** The config path field, named once for the form and for its wait. */
const configPathField = {
  label: "Config path",
  name: "config-path",
  type: "text",
} as const;

/**
 * The line under the panel that leads to the CLI form, for every reader who
 * can create a project: a repository the App cannot read publishes with the
 * CLI. While the step reads, the line draws its words as text with no link,
 * in the box the link takes.
 */
function cliLine(workspace?: Workspace) {
  const words = "Publish with the CLI instead";
  return (
    <p className="fo-account-switch">
      {workspace ? (
        <AppLink href={workspaceCliProjectPath(workspace.slug)}>
          {words}
        </AppLink>
      ) : (
        <span className="fo-account-switch-text">{words}</span>
      )}
    </p>
  );
}

/**
 * The step while the session, the workspace or its repositories are read: its
 * own form, with the Repository field holding the read's name, every other
 * field in its waiting form, and Create project, whose label is known,
 * disabled. What the workspace decides draws as the workspace says once it is
 * known, and as a new workspace's until then: a connected install step, the
 * free plan's line and the line to the CLI form, which a reviewer is not
 * offered.
 */
export function ChooseRepositoryWait({
  identity,
  workspace,
}: {
  identity: WaitingIdentity;
  workspace?: Workspace;
}) {
  return (
    <RepositoryStep
      identity={identity}
      installed={
        workspace === undefined ||
        workspace.githubInstallationState === "connected"
      }
      below={workspace?.role === "reviewer" ? undefined : cliLine()}
      wait={(panel) => <Pending label="Loading repositories">{panel}</Pending>}
    >
      {(name) => (
        <RepositoryForm
          repository={<RepositoryField waiting hold={name} />}
          configPath={<Field {...configPathField} waiting />}
          address={<ProjectAddress waiting />}
          free={workspace === undefined || workspace.plan === "free"}
          submit={
            <div className="fo-account-actions">
              <Action label="Create project" tone="primary" block disabled />
            </div>
          }
        />
      )}
    </RepositoryStep>
  );
}

/**
 * What the reader is being asked for. The installed list is one situation; a
 * list that could not be read and a list the App was given nothing for are the
 * other two.
 */
type Stage = "loading" | "failed" | "empty" | "listed";

/**
 * The third setup step: one field over the repositories the workspace's
 * connected accounts return, whatever their count, then the config path, the
 * project's address and the one action that creates the project. The select
 * offers only repositories the App can read, so a workspace with nothing
 * connected is handed back to the install step rather than shown a field
 * with nothing in it; a repository the App cannot read publishes with the
 * CLI, which the line under the panel offers every reader who can create a
 * project.
 */
export function ChooseRepositoryScreen({
  user,
  workspace,
}: {
  user: User;
  workspace: Workspace;
}) {
  const router = useRouter();
  const search = useAddressSearch();
  const bound = workspace.githubInstallationState === "connected";
  const choices = useResource(
    () => loadRepositoryChoices(workspace.id),
    "repository-choices:" + workspace.id,
    bound,
    [workspaceResourceScope(workspace.id)],
  );
  const [repositoryId, setRepositoryId] = useState("");
  const [configPath, setConfigPath] = useState("mokly.config.json");
  const state = choices.state;
  // A settings write can change the accounts while the reader answers, so the
  // list is read again with the answers kept, and nothing is sent until it
  // has: the chosen repository may be one the change took away.
  const refreshing = isRefreshing(state);
  const chosen =
    state.status === "ready"
      ? chosenRepository(state.value.accounts, repositoryId)
      : undefined;
  const { suggestion, write, submit } = useRepositoryProject(
    workspace.id,
    chosen,
    configPath.trim(),
  );

  // An open settings dialog goes along, so a pane that took the last account
  // away stays open over the install step to say what is left.
  useEffect(() => {
    if (!bound) {
      replaceAddress(
        router,
        carrySettings(installStepPath(workspace.id), search),
      );
    }
  }, [bound, workspace.id, router, search]);

  const stage: Stage =
    state.status === "loading"
      ? "loading"
      : state.status === "error"
        ? "failed"
        : state.value.accounts.every(
              (account) => account.repositories.length === 0,
            )
          ? "empty"
          : "listed";

  // A repository that already has a project is a cause this form's own field
  // owns, so the control keeps its own label and the fragment above it stays
  // quiet: pressing Create project again would send the same repository and be
  // refused the same way, and the way on is the link to that project above it
  // rather than a retry.
  //
  // `validation-failed` is not owned here. The values the reader types are
  // the config path and the slug, and the reason does not say which of them
  // was refused, so it is reported above the control like every other cause
  // this form cannot place.
  const failure = formFailure(write, {
    "duplicate-project": "repository",
    ...slugFieldOwners,
  });
  const identity = { kind: "signed-in", user } as const;
  if (stage === "loading")
    return <ChooseRepositoryWait identity={identity} workspace={workspace} />;
  return (
    <RepositoryStep
      identity={identity}
      installed={bound}
      // A reviewer creates no project, so is not offered the CLI form.
      below={workspace.role === "reviewer" ? undefined : cliLine(workspace)}
    >
      {stage === "failed" && state.status === "error" && (
        <>
          {/* A failure names what went wrong before it offers the one way on:
              ask again. */}
          <StateMessage
            title="Repositories couldn’t load"
            error
            details={<ErrorDetails reference={state.error.requestId} />}
          />
          <div className="fo-account-actions">
            <Action
              label="Try again"
              tone="primary"
              icon="retry"
              block
              onPress={choices.reload}
              testID="retry-repositories"
            />
          </div>
        </>
      )}
      {state.status === "ready" && (
        <RepositoryForm
          repository={
            <RepositoryField
              choices={state.value}
              value={repositoryId}
              onChange={setRepositoryId}
              readOnly={write.working}
            />
          }
          configPath={
            <Field
              {...configPathField}
              value={configPath}
              onChange={setConfigPath}
              disabled={write.working}
            />
          }
          address={
            <ProjectAddress
              workspaceSlug={workspace.slug}
              suggestion={suggestion}
              disabled={write.working}
              error={failure.on("slug")}
            />
          }
          free={workspace.plan === "free"}
          submit={
            <>
              <ExistingProject error={write.error} />
              {failure.around(
                <div className="fo-account-actions">
                  <Action
                    label={failure.label(
                      "Create project",
                      "Creating…",
                      "Try again",
                    )}
                    tone="primary"
                    block
                    write={write}
                    operation="Creating project"
                    disabled={write.disabled || refreshing}
                    onPress={() => void submit()}
                    testID="create-project"
                  />
                </div>,
              )}
            </>
          }
        />
      )}
    </RepositoryStep>
  );
}
