import type { ViewerScheme, ViewerSelection, ViewerViewport } from "./host";
import { isScreenPath } from "./screen-path";
import type { ShareableScreen } from "./screens";
import type { SelectionDefaults } from "./selection";

/**
 * The selection a share link pins. The panel is transient and the view is the
 * reader's own place in the package, so neither is shared; what remains is the
 * screen and the two values that decide how it is drawn — and those only when
 * the reader moved them, because a preference is theirs rather than something
 * to write into a link somebody else opens. A screen that the light fallback
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
    viewport:
      selection.viewport === "desktop" || selection.viewport === "both"
        ? undefined
        : selection.viewport,
    scheme:
      screen !== undefined && screen.scheme !== selection.scheme
        ? screen.scheme
        : selection.scheme === defaults.scheme
          ? undefined
          : selection.scheme,
  };
}

/**
 * The API-minted app URL with package state the Share operation cannot model.
 * `both` is a supported viewer viewport but not a supported API input, so the
 * host carries it only after the API has validated and minted the destination.
 */
export function sharedViewerUrl(
  canonicalUrl: string,
  selection: ViewerSelection,
): string {
  if (selection.viewport !== "both") return canonicalUrl;
  const shared = new URL(canonicalUrl);
  shared.searchParams.set("viewport", "both");
  return shared.href;
}
