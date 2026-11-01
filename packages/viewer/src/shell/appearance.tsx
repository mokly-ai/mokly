/**
 * The standalone catalogue's one Appearance control. It sets the interface and
 * the previews together, so a standalone document needs no separate preview
 * switch; an embedded root keeps its own controls instead. This wrapper reads
 * the shell's identifier scope and routed workspace, and
 * `@mokly/ui/appearance-selector` renders the control.
 */

import { AppearanceSelector } from "@mokly/ui/appearance-selector";

import type { ViewerTheme } from "../viewer/types.js";

import { useShellIdentifier } from "./identifier_context.js";
import { VIEW_CHANGED_IDS, VIEW_CHANGED_TEXT } from "./view_marks.js";
import { useActiveWorkspace } from "./workspace_context.js";

/**
 * Rendered hidden: the control cannot do anything until the startup asset
 * installs its behaviour, and CSS alone still gives the initial and Auto
 * appearance, so a reader without JavaScript is never shown a dead control.
 */
export function AppearanceSelect(props: {
  ready: boolean;
  theme: ViewerTheme;
}) {
  const changed = useActiveWorkspace()?.marks.scheme ?? false;
  const changedId = useShellIdentifier(VIEW_CHANGED_IDS.scheme);
  return (
    <AppearanceSelector
      changed={changed}
      changedId={changedId}
      changedText={VIEW_CHANGED_TEXT.scheme}
      hidden={!props.ready}
      value={props.theme}
    />
  );
}
