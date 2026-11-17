import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import type { RowMenuContent } from "../../../components/responsive-menu";
import { MenuSheet } from "../../../components/responsive-menu";
import { Badge } from "../../../entries/design/badge.mockup";
import { ResponsiveMenu } from "../../../entries/design/responsive-menu.mockup";
import { token } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, Section, StateMessage } from "../page-parts";
import { NoteRowPlaceholder } from "../placeholder-rows";
import { ControlPlaceholder } from "../placeholders";
import { BadgePlaceholder, MenuTriggerPlaceholder } from "./row-placeholders";
import { SettingsSurface } from "./surface";

/** The token row's own actions, which its trigger and its open sheet share. */
const tokenMenu: RowMenuContent = {
  accessibilityLabel: "Actions for " + token.name,
  title: token.name,
  entries: [{ id: "revoke", label: "Revoke", danger: true }],
};

/**
 * One publishing token, with its own actions gathered behind a single
 * three-dot trigger. A list of rows carries one control each rather than a line
 * of competing buttons, and the destructive row is named by what it does.
 */
function TokenRow({ menuOpen = false }: { menuOpen?: boolean }) {
  return (
    <div className="fo-note">
      <div className="fo-note-actions">
        <div className="fo-note-facts">
          <div className="fo-note-head">
            <span className="fo-note-title">{token.name}</span>
            <Badge label="Active" tone="success" dot />
          </div>
          <code className="mono-value">{token.prefix}</code>
          <span className="fo-note-detail numeric">{token.detail}</span>
        </div>
        <ResponsiveMenu
          moklyInstance="token-actions"
          {...tokenMenu}
          open={menuOpen}
          hostedSheet
        />
      </div>
    </div>
  );
}

/** The width of Create token at the section action's size, in px. */
const createTokenWidth = 121;

/**
 * The active tokens under their heading, with the one control that makes
 * another. While the list is read it keeps this layout: only a list with a
 * token shows the heading and the section's control, so both wait in their own
 * places, and one placeholder row stands for the tokens, with a bar for the
 * name, the prefix and the dates, each in its own line box, and placeholders
 * for the status badge and the row's menu.
 */
function ActiveTokens({
  menuOpen = false,
  waiting = false,
}: {
  menuOpen?: boolean;
  waiting?: boolean;
}) {
  return (
    <div className="fo-stack">
      <Section
        title={waiting ? { bar: "6.5em" } : "Active tokens"}
        action={
          waiting ? (
            <ControlPlaceholder size="sm" width={createTokenWidth} />
          ) : (
            <Action
              label="Create token"
              to="product/settings/tokens/create"
              size="sm"
              icon="start"
            />
          )
        }
      >
        {waiting ? (
          <NoteRowPlaceholder
            head={<BadgePlaceholder />}
            lines={["mono-value", "fo-note-detail numeric"]}
            end={<MenuTriggerPlaceholder />}
          />
        ) : (
          <TokenRow menuOpen={menuOpen} />
        )}
      </Section>
    </div>
  );
}

/**
 * The pane itself: the tokens this project publishes with, and the one control
 * that makes another. Creating a token, revealing its secret and revoking one
 * are questions the pane asks in a modal over itself, so this list keeps its
 * place while the reader answers. On mobile the row's open menu is a sheet over
 * the whole layer, so it takes the same modal slot.
 */
export function TokensPane({
  state,
  viewport,
  menuOpen,
  modal,
  screen,
}: {
  state: ScreenState;
  viewport: Viewport;
  menuOpen?: boolean;
  modal?: ReactNode;
  screen?: string;
}) {
  const overlay =
    menuOpen && viewport === "mobile" ? <MenuSheet {...tokenMenu} /> : modal;
  return (
    <SettingsSurface
      pane="tokens"
      state={state}
      screen={screen}
      modal={overlay}
      viewport={viewport}
      title="Publishing tokens"
    >
      {state === "loading" ? (
        <Pending
          label="Loading publishing tokens"
          labelMode="screen-reader-only"
        >
          <ActiveTokens waiting />
        </Pending>
      ) : state === "error" ? (
        <StateMessage
          title="Tokens couldn’t load"
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              to="product/settings/tokens"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      ) : state === "empty" ? (
        <StateMessage
          title="Create a publishing token"
          icon="tokens"
          action={
            <Action
              label="Create token"
              to="product/settings/tokens/create"
              tone="primary"
              size="md"
              icon="start"
            />
          }
        >
          A token lets your workflow publish this project.
        </StateMessage>
      ) : (
        <ActiveTokens menuOpen={menuOpen} />
      )}
    </SettingsSurface>
  );
}

export function SettingsTokensScreen({ viewport }: { viewport: Viewport }) {
  return <TokensPane viewport={viewport} state="default" />;
}

export function SettingsTokensEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <TokensPane viewport={viewport} state="empty" />;
}

export function SettingsTokensLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <TokensPane viewport={viewport} state="loading" />;
}

export function SettingsTokensErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <TokensPane viewport={viewport} state="error" />;
}

/** The row's own actions, open, with revoking named by what it does. */
export function SettingsTokensMenuScreen({ viewport }: { viewport: Viewport }) {
  return (
    <TokensPane
      viewport={viewport}
      state="default"
      menuOpen
      screen="product/settings/tokens/revoke/menu"
    />
  );
}
