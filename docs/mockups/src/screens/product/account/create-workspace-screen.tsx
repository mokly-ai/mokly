import type { Viewport } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { addresses } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  causes,
  failureReference,
  onboarding,
  slugRefusals,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { Action, AddressPreview, Pending, StateMessage } from "../page-parts";
import { TextBar } from "../placeholders";
import { AccountShell } from "./account-shell";

type SlugRefusal = "taken" | "reserved";

/**
 * What the step runs beside its four states: Create workspace's write, and
 * the address suggestion while it loads or after it failed.
 */
type Activity = "creating" | "suggestion-loading" | "suggestion-error";

/**
 * The first setup step. While the session read runs, the step draws its own
 * form in waiting form: the fields and the address hold bars, Create
 * workspace is disabled, and the header holds the identity's placeholder.
 * While Create workspace's write runs, the control carries the wait and the
 * form inserts nothing; while the address suggestion loads, the address line
 * names it in place of the address.
 */
function CreateWorkspacePage({
  state,
  slugRefusal,
  activity,
  screen,
}: {
  state: ScreenState;
  slugRefusal?: SlugRefusal;
  activity?: Activity;
  screen?: string;
}) {
  const waits = state === "loading";
  const creating = activity === "creating";
  const suggestionError = activity === "suggestion-error";
  const slug =
    state === "empty" || suggestionError ? "" : onboarding.workspaceSlug;
  // The operation is named by the control and the cause by the message, as
  // every settings pane does; the name the reader typed is not what failed.
  const submit = (
    <div className="fo-account-actions">
      {creating ? (
        <Action
          label="Creating…"
          tone="primary"
          block
          busy="Creating workspace"
        />
      ) : (
        <Action
          label={
            state === "error" && slugRefusal === undefined
              ? "Try again"
              : "Create workspace"
          }
          to={
            state === "error" || slugRefusal || waits
              ? undefined
              : "product/account/install-app"
          }
          tone="primary"
          block
          disabled={waits || state === "empty" || suggestionError}
        />
      )}
    </div>
  );
  // A registered wrapper refuses an `undefined` prop, so each field names its
  // value, its waiting form or its refusal only where it has one.
  const workspaceName = state === "empty" ? "" : onboarding.workspace;
  return (
    <AccountShell
      id={screen ?? stateScreenPath("product/account/create-workspace", state)}
      title="Create a workspace"
      identity={waits ? { kind: "waiting" } : { kind: "signed-in" }}
      step={1}
      wait={waits ? "Opening Mokly" : undefined}
    >
      <Input
        moklyInstance="create-workspace-name"
        label="Workspace name"
        name="workspace-name"
        type="text"
        {...(waits
          ? { waiting: true }
          : { value: workspaceName, disabled: creating })}
      />
      <Input
        moklyInstance="create-workspace-slug"
        label="Workspace slug"
        name="workspace-slug"
        type="identifier"
        {...(waits ? { waiting: true } : { value: slug, disabled: creating })}
        {...(slugRefusal === "taken"
          ? { error: slugRefusals.createWorkspaceTaken }
          : slugRefusal === "reserved"
            ? { error: slugRefusals.createWorkspaceReserved }
            : {})}
      />
      {waits ? (
        <AddressPreview hold={<TextBar width="min(12em, 100%)" />} />
      ) : activity === "suggestion-loading" ? (
        <Pending label="Finding an available address">
          {(name) => <AddressPreview hold={name} />}
        </Pending>
      ) : (
        <AddressPreview address={addresses.root + "/" + slug} />
      )}
      {suggestionError && (
        <StateMessage
          title="Address couldn’t load"
          error
          reference={failureReference}
          action={<Action label="Try again" tone="primary" icon="retry" />}
        />
      )}
      {state === "error" || slugRefusal ? (
        <WriteFailure
          moklyInstance="create-workspace-failure"
          // The field already says what was wrong with a refused slug, so the
          // fragment names no cause and leaves the prop out.
          {...(slugRefusal ? {} : { cause: causes.busy })}
          reference={failureReference}
          control={submit}
        />
      ) : (
        submit
      )}
    </AccountShell>
  );
}

export function CreateWorkspaceScreen(_props: { viewport: Viewport }) {
  return <CreateWorkspacePage state="default" />;
}

export function CreateWorkspaceEmptyScreen(_props: { viewport: Viewport }) {
  return <CreateWorkspacePage state="empty" />;
}

/** The session read: the step's own form in waiting form. */
export function CreateWorkspaceLoadingScreen(_props: { viewport: Viewport }) {
  return <CreateWorkspacePage state="loading" />;
}

export function CreateWorkspaceErrorScreen(_props: { viewport: Viewport }) {
  return <CreateWorkspacePage state="error" />;
}

/** Create workspace's write: the form, with the control busy. */
export function CreateWorkspaceCreatingScreen(_props: { viewport: Viewport }) {
  return (
    <CreateWorkspacePage
      state="default"
      activity="creating"
      screen="product/account/create-workspace/creating"
    />
  );
}

export function CreateWorkspaceSlugTakenScreen(_props: { viewport: Viewport }) {
  return (
    <CreateWorkspacePage
      state="default"
      slugRefusal="taken"
      screen="product/account/create-workspace/slug"
    />
  );
}

export function CreateWorkspaceSlugReservedScreen(_props: {
  viewport: Viewport;
}) {
  return (
    <CreateWorkspacePage
      state="default"
      slugRefusal="reserved"
      screen="product/account/create-workspace/slug/error"
    />
  );
}

export function CreateWorkspaceSuggestionErrorScreen(_props: {
  viewport: Viewport;
}) {
  return (
    <CreateWorkspacePage
      state="default"
      activity="suggestion-error"
      screen="product/account/create-workspace/slug/empty"
    />
  );
}

export function CreateWorkspaceSuggestionLoadingScreen(_props: {
  viewport: Viewport;
}) {
  return (
    <CreateWorkspacePage
      state="default"
      activity="suggestion-loading"
      screen="product/account/create-workspace/suggestion-loading"
    />
  );
}
