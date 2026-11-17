import { Badge } from "../../../entries/design/badge.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import { profile } from "../../../fixtures/product-states";
import { Action, Section } from "../page-parts";
import { ControlPlaceholder, TextBar } from "../placeholders";

import { BadgePlaceholder } from "./row-placeholders";

/**
 * What the Account pane asked for by its address waits for: the settings
 * scope, with the session known, or the session itself, before the scope is
 * read.
 */
export type AccountWait = "scope" | "session";

/** The width of Disconnect GitHub at a page action's size, in px. */
const disconnectWidth = 153;

/** The width of the Connected badge with its dot, in px. */
const connectedWidth = 96;

/**
 * The reader's GitHub connection. Connecting leaves for GitHub's authorization
 * and comes back to this pane, so while it runs, Connect GitHub stays busy
 * until the page leaves. While the settings scope loads, the session already
 * says whether the reader is connected, so the control draws itself, disabled.
 * While the session loads, nothing says it yet, so the note draws its most
 * common form, a connected account, with the account, its status and its
 * control as placeholders.
 */
export function GithubSection({
  state,
  wait,
  connecting,
}: {
  state: ScreenState;
  wait: AccountWait | undefined;
  connecting: boolean;
}) {
  return (
    <Section
      title="GitHub"
      description="Mokly publishes from the repositories this account can read."
    >
      {wait === "session" ? (
        <div className="fo-note">
          <div className="fo-note-head">
            <TextBar className="fo-note-title" width="7em" />
            <BadgePlaceholder width={connectedWidth} />
          </div>
          <div>
            <ControlPlaceholder size="md" width={disconnectWidth} />
          </div>
        </div>
      ) : state === "empty" ? (
        <>
          <p className="fo-copy">
            Connect GitHub to publish from your repositories.
          </p>
          <div>
            <Action
              label={connecting ? "Connecting…" : "Connect GitHub"}
              tone="primary"
              size="md"
              icon="github"
              disabled={wait !== undefined}
              busy={connecting ? "Connecting to GitHub" : undefined}
            />
          </div>
        </>
      ) : (
        <div className="fo-note">
          <div className="fo-note-head">
            <span className="fo-note-title">{profile.github}</span>
            <Badge label="Connected" tone="success" dot />
          </div>
          <div>
            <Action
              label="Disconnect GitHub"
              tone="quiet"
              size="md"
              disabled={wait !== undefined}
            />
          </div>
        </div>
      )}
    </Section>
  );
}
