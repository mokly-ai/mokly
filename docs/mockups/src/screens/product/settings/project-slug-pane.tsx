import type { Viewport } from "@mokly/mokly";

import type { ScreenState } from "../../../fixtures/product-states";

import { SlugEditor } from "./slug-editor";

function ProjectSlugScreen({
  viewport,
  state,
}: {
  viewport: Viewport;
  state: ScreenState;
}) {
  return <SlugEditor subject="project" viewport={viewport} state={state} />;
}

export function SettingsProjectSlugScreen(props: { viewport: Viewport }) {
  return <ProjectSlugScreen {...props} state="default" />;
}

export function SettingsProjectSlugEmptyScreen(props: { viewport: Viewport }) {
  return <ProjectSlugScreen {...props} state="empty" />;
}

export function SettingsProjectSlugLoadingScreen(props: {
  viewport: Viewport;
}) {
  return <ProjectSlugScreen {...props} state="loading" />;
}

export function SettingsProjectSlugErrorScreen(props: { viewport: Viewport }) {
  return <ProjectSlugScreen {...props} state="error" />;
}

export function SettingsProjectSlugConflictScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <SlugEditor
      subject="project"
      viewport={viewport}
      state="default"
      conflict
      screen="product/settings/project/slug/conflict"
    />
  );
}
