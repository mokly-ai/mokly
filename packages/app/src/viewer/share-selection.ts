import type { ViewerScheme, ViewerSelection, ViewerViewport } from "./host";
import { isScreenPath } from "./screen-path";
import type { ShareableScreen } from "./screens";
import type { SelectionDefaults } from "./selection";

/**
 * The selection a share link pins. The panel is transient and the view is the
 * reader's own place in the package, so neither is shared; what remains is the
 * screen and the two values that decide how it is drawn, each only when the
 * reader moved it off its default. Desktop and Mobile go in, and Both, the
 * default viewport that the Share API cannot name, stays out, so the link
 * opens on the reader's viewport either way. The scheme goes in only when it
 * is not the reader's preference, which is theirs rather than something to
 * write into a link somebody else opens. A screen that the light fallback
 * shows under Dark is the exception: its link always names the light view,
 * because that is the view the reader sees.
 */
export function shareSelection(
  selection: ViewerSelection,
  defaults: SelectionDefaults,
  shared: Pick<ShareableScreen, "path" | "scheme"> | undefined,
): {
  screen?: string;
  viewport?: Exclude<ViewerViewport, "both">;
  scheme?: ViewerScheme;
} {
  const screen =
    shared !== undefined && isScreenPath(shared.path) ? shared : undefined;
  return {
    screen: screen?.path,
    viewport: selection.viewport === "both" ? undefined : selection.viewport,
    scheme:
      screen !== undefined && screen.scheme !== selection.scheme
        ? screen.scheme
        : selection.scheme === defaults.scheme
          ? undefined
          : selection.scheme,
  };
}
