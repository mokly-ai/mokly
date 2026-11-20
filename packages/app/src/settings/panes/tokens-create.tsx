import { useCallback, useEffect, useRef, useState } from "react";
import type { View } from "react-native";

import type { Project, TokenCreated } from "../../api/types";
import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { writeFailure } from "../../components/write-failure";
import { createToken } from "../../data/tokens";
import { SettingsModal } from "../modal";
import { useWrite } from "../write";

/**
 * The one render of the secret, and the only chance to take it. A clipboard
 * the browser refused was never a request Mokly answered, so there is no
 * reference to disclose and the control keeps its own label: there is nothing
 * to send again. Focus moves to the copy control as the secret appears, because
 * the control that made the token is gone and the secret is the reader's
 * next step.
 */
function RevealedToken({
  created,
  onDone,
}: {
  created: TokenCreated;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState<boolean | undefined>(undefined);
  const copyRef = useRef<View>(null);
  useEffect(() => {
    copyRef.current?.focus();
  }, []);
  return (
    <>
      <div className="fo-note">
        <div className="fo-note-head">
          <span className="fo-note-title">{created.token.name}</span>
        </div>
        <code className="fo-secret">{created.secret}</code>
        {writeFailure(
          copied === false
            ? "Copying didn’t work here. Select the token above and copy it."
            : undefined,
          undefined,
          <div>
            <Action
              label={copied === true ? "Copied" : "Copy token"}
              tone="primary"
              size="md"
              buttonRef={copyRef}
              onPress={() => {
                const clipboard = window.navigator.clipboard;
                if (!clipboard) {
                  setCopied(false);
                  return;
                }
                void clipboard
                  .writeText(created.secret)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
              testID="copy-token"
            />
          </div>,
        )}
      </div>
      <div className="fo-panel-foot">
        <Action
          label="Done"
          tone="quiet"
          size="md"
          onPress={onDone}
          testID="token-done"
        />
      </div>
    </>
  );
}

/**
 * Naming a token is the whole question, so the modal asks it and nothing else,
 * then reveals the secret in place once the token exists, because the reader
 * is still inside the operation they started. The name belongs to the modal
 * rather than to the settings drafts: the question is answered or declined in
 * one sitting, and declining it — Cancel, Escape or a press outside — discards
 * it. The reveal can be closed only by Done: a stray press outside must not
 * lose a secret that is never shown again.
 */
export function CreateToken({
  project,
  onClose,
  onCreated,
}: {
  project: Project;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<TokenCreated | undefined>(undefined);
  const creation = useWrite(onCreated, name.trim().length > 0);
  const create = useCallback(
    () =>
      creation.run(async () => {
        setCreated(await createToken(project.id, name.trim()));
      }),
    [creation, name, project.id],
  );

  const failure = formFailure(creation, { "validation-failed": "name" });
  if (created)
    return (
      <SettingsModal
        title="Save your token"
        description="Copy it now. You can view this secret only once."
        onClose={onClose}
        dismissible={false}
        testID="create-token-modal"
      >
        <RevealedToken created={created} onDone={onClose} />
      </SettingsModal>
    );
  return (
    <SettingsModal
      title="Create a token"
      onClose={onClose}
      dismissible={!creation.working}
      actions={
        <Action
          label="Cancel"
          tone="quiet"
          size="sm"
          disabled={creation.working}
          onPress={onClose}
          testID="cancel-token"
        />
      }
      testID="create-token-modal"
    >
      <div className="fo-form">
        <Field
          label="Token name"
          name="token-name"
          type="text"
          value={name}
          onChange={setName}
          placeholder="GitHub Actions"
          autoFocus
          disabled={creation.working}
          error={failure.on("name")}
        />
        {failure.around(
          <div>
            <Action
              label={failure.label("Create token", "Creating…")}
              tone="primary"
              size="md"
              icon="start"
              write={creation}
              operation="Creating token"
              onPress={() => void create()}
              testID="create-token"
            />
          </div>,
        )}
      </div>
    </SettingsModal>
  );
}
