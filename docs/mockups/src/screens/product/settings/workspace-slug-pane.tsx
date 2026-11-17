import type { Viewport } from "@mokly/mokly";

import type { ScreenState } from "../../../fixtures/product-states";
import { SlugEditor } from "./slug-editor";

function WorkspaceSlugScreen({
  viewport,
  state,
}: {
  viewport: Viewport;
  state: ScreenState;
}) {
  return <SlugEditor subject="workspace" viewport={viewport} state={state} />;
}

export function SettingsWorkspaceSlugScreen(props: { viewport: Viewport }) {
  return <WorkspaceSlugScreen {...props} state="default" />;
}

export function SettingsWorkspaceSlugEmptyScreen(props: {
  viewport: Viewport;
}) {
  return <WorkspaceSlugScreen {...props} state="empty" />;
}

export function SettingsWorkspaceSlugLoadingScreen(props: {
  viewport: Viewport;
}) {
  return <WorkspaceSlugScreen {...props} state="loading" />;
}

export function SettingsWorkspaceSlugErrorScreen(props: {
  viewport: Viewport;
}) {
  return <WorkspaceSlugScreen {...props} state="error" />;
}

export function SettingsWorkspaceSlugConflictScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <SlugEditor
      subject="workspace"
      viewport={viewport}
      state="default"
      conflict
      screen="product/settings/workspace/slug-recovery/error"
    />
  );
}

export function SettingsWorkspaceSlugReservedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <SlugEditor
      subject="workspace"
      viewport={viewport}
      state="default"
      reserved
      screen="product/settings/workspace/slug-recovery"
    />
  );
}
