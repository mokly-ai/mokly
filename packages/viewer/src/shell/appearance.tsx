/**
 * The standalone catalogue's one Appearance control. It sets the interface and
 * the previews together, so a standalone document needs no separate preview
 * switch; an embedded root keeps its own controls instead. A screen and a
 * component show the frames of both schemes on the canvas, where the Frames
 * filter marks a hidden changed view, so the control marks no change for
 * them. This wrapper reads the shell's identifier scope, and
 * `@mokly/ui/appearance-selector` renders the control.
 */

import { AppearanceSelector } from "@mokly/ui/appearance-selector";

import type { ViewerTheme } from "../host/types.js";

import { useShellIdentifier } from "./identifier_context.js";
import { VIEW_CHANGED_IDS, VIEW_CHANGED_TEXT } from "./view_marks.js";

/** Appearance data and callback supplied by the standalone root. */
export interface AppearanceState {
  ready: boolean;
  theme: ViewerTheme;
  onChange?: ((theme: ViewerTheme) => void) | undefined;
}

/** Show the selector only when its React change handler is installed. */
export function AppearanceSelect(props: AppearanceState) {
  const changedId = useShellIdentifier(VIEW_CHANGED_IDS.scheme);
  return (
    <AppearanceSelector
      changed={false}
      changedId={changedId}
      changedText={VIEW_CHANGED_TEXT.scheme}
      hidden={!props.ready}
      controlled
      {...(props.onChange ? { onChange: props.onChange } : {})}
      value={props.theme}
    />
  );
}
