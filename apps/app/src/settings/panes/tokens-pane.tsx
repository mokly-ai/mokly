import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { Project, Token } from "../../api/types";
import { Action } from "../../components/action";
import { StatusBadge } from "../../components/controls";
import { Pending, Section, StateMessage } from "../../components/page-parts";
import type { SectionTitle } from "../../components/page-parts";
import { NoteRowPlaceholder } from "../../components/placeholder-rows";
import { ControlPlaceholder } from "../../components/placeholders";
import { PaneResource } from "../../components/resource-state";
import { listTokens } from "../../data/tokens";
import { useResource } from "../../data/use-resource";
import { RowMenu } from "../row-menu";

import { BadgePlaceholder, MenuTriggerPlaceholder } from "./row-placeholders";
import { CreateToken } from "./tokens-create";
import { RevokeToken } from "./tokens-revoke";

/**
 * One publishing token, with its own actions behind a single three-dot
 * trigger. Revoking is asked over the row in a modal; a revoked token has no
 * actions left, and a reader who cannot administer the project has none.
 */
function TokenRow({
  token,
  project,
  onRevoked,
}: {
  token: Token;
  project: Project;
  onRevoked: () => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const close = useCallback(() => setRevoking(false), []);
  return (
    <div className="fo-note">
      <div className="fo-note-actions">
        <div className="fo-note-facts">
          <div className="fo-note-head">
            <span className="fo-note-title">{token.name}</span>
            <StatusBadge
              label={token.revoked ? "Revoked" : "Active"}
              tone={token.revoked ? "neutral" : "success"}
              dot
            />
          </div>
          <code className="mono-value">{token.prefix}</code>
          <span className="fo-note-detail numeric">
            Created {new Date(token.createdAt).toLocaleDateString()}
            {token.lastUsedAt
              ? ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`
              : " · Never used"}
          </span>
        </div>
        {!token.revoked && project.canAdmin && (
          <RowMenu
            label={"Actions for " + token.name}
            title={token.name}
            testID={"token-actions-" + token.id}
            entries={[
              {
                id: "revoke",
                label: "Revoke",
                danger: true,
                onPress: () => setRevoking(true),
                testID: "revoke-" + token.id,
              },
            ]}
          />
        )}
      </div>
      {revoking && (
        <RevokeToken
          token={token}
          project={project}
          onClose={close}
          onRevoked={onRevoked}
        />
      )}
    </div>
  );
}

/** The width in px of Create token at the section action's size. */
const createTokenWidth = 121;

/**
 * The active tokens under their heading, with the section's one control,
 * which the pane and its wait both draw.
 */
function ActiveTokens({
  title,
  action,
  children,
}: {
  title: SectionTitle;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section title={title} action={action}>
      {children}
    </Section>
  );
}

/**
 * The tokens while they are read. Only a list with a token shows the heading
 * and the section's control, so both wait in their own places, and one
 * placeholder row stands for the tokens: a bar for the name, the prefix and
 * the dates, each in its own line box, and placeholders for the status badge
 * and the row's menu. A reader who cannot administer the project gets neither
 * the control nor a row menu, so their wait draws neither.
 */
export function TokensWait({ admin = true }: { admin?: boolean }) {
  return (
    <div className="fo-stack">
      <ActiveTokens
        title={{ bar: "6.5em" }}
        action={
          admin ? (
            <ControlPlaceholder size="sm" width={createTokenWidth} />
          ) : undefined
        }
      >
        <NoteRowPlaceholder
          head={<BadgePlaceholder />}
          lines={["mono-value", "fo-note-detail numeric"]}
          end={admin ? <MenuTriggerPlaceholder /> : undefined}
        />
      </ActiveTokens>
    </div>
  );
}

/**
 * Publishing tokens and the one control that makes another. Creating a token,
 * revealing its secret and revoking one are questions the pane asks in a modal
 * over itself, so the list keeps its place while the reader answers.
 */
export function TokensPane({ project }: { project: Project }) {
  const tokens = useResource(
    () => listTokens(project.id),
    "tokens:" + project.id,
  );
  const [creating, setCreating] = useState(false);
  const closeCreate = useCallback(() => setCreating(false), []);
  const newToken = (tone: "primary" | "secondary", size: "sm" | "md") =>
    project.canAdmin ? (
      <Action
        label="Create token"
        tone={tone}
        size={size}
        icon="start"
        onPress={() => setCreating(true)}
        testID="new-token"
      />
    ) : undefined;
  // The create modal sits beside the list rather than inside it: making a token
  // reloads the list, and the modal must outlive that reload to show the secret.
  return (
    <>
      <PaneResource
        resource={tokens.state}
        waiting={
          <Pending
            label="Loading publishing tokens"
            labelMode="screen-reader-only"
          >
            <TokensWait admin={project.canAdmin} />
          </Pending>
        }
        failure="Tokens couldn’t load"
        onRetry={tokens.reload}
      >
        {(items) => (
          <div className="fo-stack">
            {items.length === 0 ? (
              <StateMessage
                title="Create a publishing token"
                icon="tokens"
                action={newToken("primary", "md")}
              >
                A token lets your workflow publish this project.
              </StateMessage>
            ) : (
              <ActiveTokens
                title="Active tokens"
                action={newToken("secondary", "sm")}
              >
                {items.map((token) => (
                  <TokenRow
                    key={token.id}
                    token={token}
                    project={project}
                    onRevoked={tokens.reload}
                  />
                ))}
              </ActiveTokens>
            )}
          </div>
        )}
      </PaneResource>
      {creating && (
        <CreateToken
          project={project}
          onClose={closeCreate}
          onCreated={tokens.reload}
        />
      )}
    </>
  );
}
