import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { User } from "../../api/types";
import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { formFailure, slugFieldOwners } from "../../components/form-failure";
import { ErrorDetails } from "../../components/error-details";
import {
  AddressPreview,
  Pending,
  StateMessage,
} from "../../components/page-parts";
import { TextBar } from "../../components/placeholders";
import { useSuggestedSlug } from "../../data/use-slug-suggestion";
import { createWorkspace, suggestWorkspaceSlug } from "../../data/workspaces";
import { installStepPath, workspacePath } from "../../navigation/paths";
import { useWrite } from "../../settings/write";
import { AccountShell } from "./account-shell";
import type { AccountIdentityKind, ShellWait } from "./account-shell";

/** The step's two fields, named once for the form and for its wait. */
const nameField = {
  label: "Workspace name",
  name: "workspace-name",
  type: "text",
} as const;
const slugField = {
  label: "Workspace slug",
  name: "workspace-slug",
  type: "identifier",
} as const;

/**
 * The workspace step's panel, loaded or waiting: the name, the slug, the
 * address the slug gives and Create workspace, over the strip at the first
 * step. The screen passes its live parts, and its wait passes their waiting
 * forms, so the wait cannot drift from the form.
 */
function CreateWorkspaceLayout({
  identity,
  wait,
  name,
  slug,
  address,
  submit,
}: {
  identity: AccountIdentityKind;
  wait?: ShellWait;
  name: ReactNode;
  slug: ReactNode;
  address: ReactNode;
  submit: ReactNode;
}) {
  return (
    <AccountShell
      screen="account-create-workspace"
      title="Create a workspace"
      identity={identity}
      step={1}
      wait={wait}
    >
      {name}
      {slug}
      {address}
      {submit}
    </AccountShell>
  );
}

/**
 * The step while the session read runs, which the session guard draws: its
 * own form with both fields and the address in their waiting forms, and Create
 * workspace disabled, under the identity's placeholder. No place of the form
 * waits for the session, so the read is named for screen readers only.
 */
export function CreateWorkspaceWait() {
  return (
    <CreateWorkspaceLayout
      identity={{ kind: "waiting" }}
      wait={(panel) => (
        <Pending label="Opening Mokly" labelMode="screen-reader-only">
          {panel(undefined)}
        </Pending>
      )}
      name={<Field {...nameField} waiting />}
      slug={<Field {...slugField} waiting />}
      address={<AddressPreview hold={<TextBar width="min(12em, 100%)" />} />}
      submit={
        <div className="fo-account-actions">
          <Action label="Create workspace" tone="primary" block disabled />
        </div>
      }
    />
  );
}

/**
 * The first setup step: a personal workspace, which needs no GitHub. A
 * candidate installation the connect situation sent here is carried on to the
 * install step, which then connects it to the workspace just made.
 */
export function CreateWorkspaceScreen({
  user,
  installationId,
}: {
  user: User;
  installationId?: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const trimmedName = name.trim();
  const loadSuggestion = useCallback(
    () => suggestWorkspaceSlug(trimmedName),
    [trimmedName],
  );
  const suggestion = useSuggestedSlug(trimmedName, loadSuggestion);
  const slug = suggestion.value;
  // The workspace the next step is addressed by, which only the answer
  // knows. Catching up is the write's `done` rather than the last line of the
  // attempt, so a step that cannot be opened is never reported as a request
  // that failed; `done` runs only after the answer arrived, so this is set by
  // the time it is read.
  const created = useRef("");
  const attemptedSlug = useRef("");
  const openInstall = useCallback(() => {
    router.replace(installStepPath(created.current, installationId));
  }, [router, installationId]);
  const write = useWrite(
    openInstall,
    trimmedName.length > 0 && slug.length > 0,
  );
  useEffect(() => {
    if (write.error && attemptedSlug.current !== slug) write.clearError();
  }, [slug, write]);

  const submit = useCallback(
    () =>
      write.run(async () => {
        attemptedSlug.current = slug;
        const workspace = await createWorkspace({
          name: trimmedName,
          slug,
        });
        created.current = workspace.id;
      }),
    [write, trimmedName, slug],
  );

  // The operation is named by the control and the cause by the message, as
  // every settings pane does. Only a name the reader's own text made
  // unacceptable belongs on the field; nothing else about the request does.
  const failure = formFailure(write, {
    ...slugFieldOwners,
  });
  // The suggestion decides the address, so while it is on its way the address
  // line names it in the address's place, and the form inserts nothing.
  const finding = suggestion.state.status === "loading" && !suggestion.edited;
  return (
    <CreateWorkspaceLayout
      identity={{ kind: "signed-in", user }}
      name={
        <Field
          {...nameField}
          value={name}
          onChange={setName}
          disabled={write.working}
          error={failure.on("name")}
        />
      }
      slug={
        <Field
          {...slugField}
          value={slug}
          onChange={suggestion.edit}
          onFocus={suggestion.focus}
          onBlur={suggestion.blur}
          disabled={write.working}
          error={failure.on("slug")}
        />
      }
      address={
        <>
          {finding ? (
            <Pending label="Finding an available address">
              {(held) => <AddressPreview hold={held} />}
            </Pending>
          ) : (
            <AddressPreview path={slug ? workspacePath(slug) : "/"} />
          )}
          {suggestion.state.status === "error" && !suggestion.edited && (
            <StateMessage
              title="Address couldn’t load"
              error
              details={
                <ErrorDetails reference={suggestion.state.error.requestId} />
              }
              action={
                <Action
                  label="Try again"
                  tone="primary"
                  icon="retry"
                  onPress={suggestion.reload}
                />
              }
            />
          )}
        </>
      }
      submit={failure.around(
        <div className="fo-account-actions">
          <Action
            label={failure.label("Create workspace", "Creating…", "Try again")}
            tone="primary"
            block
            write={write}
            operation="Creating workspace"
            disabled={write.disabled}
            onPress={() => void submit()}
            testID="create-workspace"
          />
        </div>,
      )}
    />
  );
}
