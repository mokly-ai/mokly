import type { Viewport } from "@mokly/mokly";

import { ContentList } from "../../../entries/design/content-list.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, Section, StateMessage } from "../page-parts";

import { paneScreenPath, panes, sections } from "./panes";
import { SettingsSurface } from "./surface";

/**
 * Every section and the panes under it. While the settings scope loads, the
 * index draws the sections that the address's scope gives an owner, as the
 * rail beside it does: every pane's name and summary are known, so they stay
 * text, and only where each row leads waits, because its address needs the
 * scope's workspace and project. So each row draws Open as text with no link.
 */
function SectionIndex({ waiting = false }: { waiting?: boolean }) {
  return (
    <div className="fo-stack">
      {sections.map((section) => (
        <Section title={section} key={section}>
          <div className="fo-panel">
            <ContentList
              moklyInstance={"settings-section-" + section.toLowerCase()}
              label={section + " settings"}
              rows={panes
                .filter((pane) => pane.section === section)
                .map((pane) => ({
                  id: pane.id,
                  title: pane.title,
                  detail: pane.summary,
                  to: paneScreenPath(pane.id),
                  action: "Open",
                  ...(waiting ? { waiting: true } : {}),
                }))}
            />
          </div>
        </Section>
      ))}
    </div>
  );
}

function SectionsPane({
  state,
  viewport,
}: {
  state: ScreenState;
  viewport: Viewport;
}) {
  return (
    <SettingsSurface
      pane="sections"
      state={state}
      viewport={viewport}
      title="Settings"
    >
      {state === "loading" ? (
        <Pending label="Loading settings" labelMode="screen-reader-only">
          <SectionIndex waiting />
        </Pending>
      ) : state === "error" ? (
        <StateMessage
          title="Settings couldn’t load"
          error
          reference={failureReference}
          action={
            <Action
              label="Try again"
              to="product/settings/sections"
              tone="primary"
              size="md"
              icon="retry"
            />
          }
        />
      ) : state === "empty" ? (
        <StateMessage
          title="Create your first workspace"
          icon="workspace"
          action={
            <Action
              label="Create workspace"
              to="product/account/create-workspace"
              tone="primary"
              size="md"
            />
          }
        >
          Workspace and project settings appear once you have one.
        </StateMessage>
      ) : (
        <SectionIndex />
      )}
    </SettingsSurface>
  );
}

export function SettingsSectionsScreen({ viewport }: { viewport: Viewport }) {
  return <SectionsPane viewport={viewport} state="default" />;
}

export function SettingsSectionsEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <SectionsPane viewport={viewport} state="empty" />;
}

export function SettingsSectionsLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <SectionsPane viewport={viewport} state="loading" />;
}

export function SettingsSectionsErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <SectionsPane viewport={viewport} state="error" />;
}
