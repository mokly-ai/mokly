import type { Viewport } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { token } from "../../../fixtures/product";
import {
  causes,
  exampleToken,
  fieldRefusals,
} from "../../../fixtures/product-states";
import { Action } from "../page-parts";

import { SettingsModal } from "./settings-modal";
import { TokensPane } from "./tokens-pane";

/**
 * Naming the token is the whole question, so the modal asks it and nothing
 * else. The same modal reveals the secret once the token exists, because the
 * reader is still in the operation they started.
 */
function CreateModal({
  working = false,
  refused = false,
}: {
  working?: boolean;
  refused?: boolean;
}) {
  return (
    <SettingsModal
      title="Create a token"
      instance="token-create"
      actions={
        <Action
          label="Cancel"
          tone="quiet"
          size="sm"
          to="product/settings/tokens"
        />
      }
    >
      <div className="fo-form">
        <Input
          label="Token name"
          name="token-name"
          type="text"
          value={working ? token.name : ""}
          placeholder={token.name}
          disabled={working}
          // The registered input refuses an `undefined` value, so a name
          // that was not refused leaves the prop out.
          {...(refused ? { error: fieldRefusals.tokenName } : {})}
        />
        <div>
          <Action
            label={working ? "Creating…" : "Create token"}
            tone="primary"
            size="md"
            icon="start"
            busy={working ? "Creating token" : undefined}
          />
        </div>
      </div>
    </SettingsModal>
  );
}

/** The one render of the secret, and the only chance to take it. */
function RevealModal({ copied }: { copied: boolean }) {
  const copy = <Action label="Copy token" tone="primary" size="md" />;
  return (
    <SettingsModal
      title="Save your token"
      description="Copy it now. You can view this secret only once."
      instance="token-reveal"
    >
      <div className="fo-note">
        <div className="fo-note-head">
          <span className="fo-note-title">{token.name}</span>
        </div>
        <code className="fo-secret">{exampleToken}</code>
        {copied ? (
          <div>{copy}</div>
        ) : (
          <WriteFailure
            moklyInstance="copy-token-failure"
            cause={causes.clipboard}
            control={copy}
          />
        )}
      </div>
      <div className="fo-panel-foot">
        <Action
          label="Done"
          tone="quiet"
          size="md"
          to="product/settings/tokens"
        />
      </div>
    </SettingsModal>
  );
}

export function SettingsTokensCreateScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      screen="product/settings/tokens/create"
      modal={<CreateModal />}
    />
  );
}

/** The write in flight: its control says what it is doing and refuses a second press. */
export function SettingsTokensCreateLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      screen="product/settings/tokens/create/loading"
      modal={<CreateModal working />}
    />
  );
}

/** A name the reader can only answer by editing belongs on the field. */
export function SettingsTokensCreateErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      screen="product/settings/tokens/create/error"
      modal={<CreateModal refused />}
    />
  );
}

export function SettingsTokensRevealScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      screen="product/settings/tokens/create/reveal"
      modal={<RevealModal copied />}
    />
  );
}

/**
 * The reveal in a browser that would not take the secret. Mokly answered no
 * request here, so there is no reference to quote and the reader is told how
 * to copy it by hand.
 */
export function SettingsTokensCopyScreen({ viewport }: { viewport: Viewport }) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      screen="product/settings/tokens/create/copy"
      modal={<RevealModal copied={false} />}
    />
  );
}
