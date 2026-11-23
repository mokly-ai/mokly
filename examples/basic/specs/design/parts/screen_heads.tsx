import { ENTRY_PATHS, SCREEN_CRUMBS } from "./entry_paths.js";
import { ScreenHead, ViewSwitch } from "./shell.js";

/**
 * The head band of the example Welcome screen with shared preview controls.
 * Its folder crumbs are text.
 */
export function WelcomeHead({
  active,
}: {
  active: "both" | "desktop" | "mobile";
}) {
  return (
    <ScreenHead
      action={<ViewSwitch active={active} />}
      crumbs={SCREEN_CRUMBS}
      path={ENTRY_PATHS.welcome}
      title="Welcome"
    />
  );
}
