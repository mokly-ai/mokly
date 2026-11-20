import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import type { User, Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { formFailure, slugFieldOwners } from "../../components/form-failure";
import { Pending } from "../../components/page-parts";
import { createProject, suggestProjectSlug } from "../../data/projects";
import { useSuggestedSlug } from "../../data/use-slug-suggestion";
import {
  installStepPath,
  projectSetupPath,
  workspaceNewProjectPath,
} from "../../navigation/paths";
import { useWrite } from "../../settings/write";

import type { WaitingIdentity } from "./account-shell";
import {
  CliForm,
  CliFormStep,
  configPathField,
  repositoryField,
} from "./cli-form-layout";
import { ExistingProject } from "./existing-project";
import { ProjectAddress } from "./project-address";
import type { SuggestedSlug } from "./project-address";
import { projectName } from "./project-name";

/**
 * A suggestion for a repository the reader is still typing. The API decides
 * the identity grammar, and it answers a partial identity with
 * `validation-failed`; that is the field being filled in, not a read that
 * failed, so it suggests nothing rather than offering the read again.
 */
function whileTyping(suggestion: SuggestedSlug): SuggestedSlug {
  const state = suggestion.state;
  return state.status === "error" && state.error.reason === "validation-failed"
    ? { ...suggestion, state: { status: "idle" } }
    : suggestion;
}

/**
 * The form while the session or its workspace is read. The workspace decides
 * the project's address, so the address line names the read; every field
 * draws its waiting form, and Create project, whose label is known, is
 * disabled. The rest draws as the form's most common way in, the repository
 * step of a workspace with a connected account on the free plan: the strip
 * credits the install step, and Back returns to the repository step of the
 * workspace the address names, which hands a workspace with nothing connected
 * on to the install step.
 */
export function CliFormWait({
  identity,
  workspaceSlug,
}: {
  identity: WaitingIdentity;
  workspaceSlug: string;
}) {
  return (
    <CliFormStep
      identity={identity}
      connected
      wait={(panel) => (
        <Pending label="Loading your workspace">{panel}</Pending>
      )}
    >
      {(name) => (
        <CliForm
          repository={<Field {...repositoryField} waiting />}
          configPath={<Field {...configPathField} waiting />}
          address={<ProjectAddress waiting hold={name} />}
          free
          submit={
            <div className="fo-account-actions">
              <Action label="Create project" tone="primary" block disabled />
            </div>
          }
          back={workspaceNewProjectPath(workspaceSlug)}
        />
      )}
    </CliFormStep>
  );
}

/**
 * A project with no repository the App reads. The reader names the
 * repository as the Mokly CLI identifies it, on any Git host, and the project
 * publishes with the CLI, by hand or from CI, through a project token. Nothing
 * is listed from GitHub, so the form has nothing to wait for but its workspace
 * and the project being created, and the project cannot build.
 *
 * The way back is the step that offered the form: the repository step for a
 * workspace with a connected account, and the install step otherwise, whose
 * strip claims no installation. A repository that already has a project is
 * refused with the way to that project, and Create project keeps its own
 * label, because sending the same repository again would be refused the same
 * way. While the project is created, the control is busy with its working
 * word and names the operation to assistive technology alone.
 */
export function CliFormScreen({
  user,
  workspace,
}: {
  user: User;
  workspace: Workspace;
}) {
  const router = useRouter();
  const connected = workspace.githubInstallationState === "connected";
  const [repository, setRepository] = useState("");
  const [configPath, setConfigPath] = useState("mokly.config.json");
  const trimmedRepository = repository.trim();
  const trimmedConfigPath = configPath.trim();
  const loadSuggestion = useCallback(
    () =>
      suggestProjectSlug(workspace.id, {
        repository: trimmedRepository,
        configPath: trimmedConfigPath,
      }),
    [workspace.id, trimmedRepository, trimmedConfigPath],
  );
  const suggestion = whileTyping(
    useSuggestedSlug(
      trimmedRepository.length > 0 && trimmedConfigPath.length > 0
        ? `${workspace.id}\n${trimmedRepository}\n${trimmedConfigPath}`
        : "",
      loadSuggestion,
    ),
  );
  const slug = suggestion.value;
  // The project the setup step is addressed by, which only the answer knows.
  const created = useRef("");
  const attempted = useRef("");
  const openSetup = useCallback(() => {
    router.replace(created.current);
  }, [router]);
  const write = useWrite(
    openSetup,
    trimmedRepository.length > 0 &&
      trimmedConfigPath.length > 0 &&
      slug.length > 0,
  );
  // A refusal belongs to the repository and the address it was made for, so
  // changing either takes it away.
  const sent = `${trimmedRepository}\n${slug}`;
  useEffect(() => {
    if (write.error && attempted.current !== sent) write.clearError();
  }, [sent, write]);

  const submit = useCallback(
    () =>
      write.run(async () => {
        attempted.current = sent;
        const project = await createProject(workspace.id, {
          name: projectName(trimmedRepository),
          slug,
          configPath: trimmedConfigPath,
          repository: trimmedRepository,
        });
        created.current = projectSetupPath(project.workspaceSlug, project.slug);
      }),
    [write, workspace.id, sent, trimmedRepository, trimmedConfigPath, slug],
  );

  // The repository is a cause this form's own field owns, so the control
  // keeps its own label and the way on is the link to the existing project.
  // `validation-failed` does not say which value was refused, so it is
  // reported above the control.
  const failure = formFailure(write, {
    "duplicate-project": "repository",
    ...slugFieldOwners,
  });
  return (
    <CliFormStep identity={{ kind: "signed-in", user }} connected={connected}>
      <CliForm
        repository={
          <Field
            {...repositoryField}
            value={repository}
            onChange={setRepository}
            placeholder="host/owner/name"
            disabled={write.working}
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
                  onPress={() => void submit()}
                  testID="create-cli-project"
                />
              </div>,
            )}
          </>
        }
        back={
          connected
            ? workspaceNewProjectPath(workspace.slug)
            : installStepPath(workspace.id)
        }
      />
    </CliFormStep>
  );
}
