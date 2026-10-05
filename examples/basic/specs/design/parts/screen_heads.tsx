import { ENTRY_PATHS, SCREEN_CRUMBS } from "./entry_paths.js";
import { ScreenHead, ViewSwitch } from "./shell.js";

/**
 * The head band of the example Welcome screen with shared preview controls.
 * From All its Example crumb opens the folder's own page; a Changes state keeps
 * the crumbs as text.
 */
export function WelcomeHead({
  active,
  changed = false,
  changes = false,
}: {
  active: "both" | "desktop" | "mobile";
  changed?: boolean;
  changes?: boolean;
}) {
  return (
    <ScreenHead
      {...(changed ? { comparisons: true, status: "changed" as const } : {})}
      action={<ViewSwitch active={active} />}
      crumbs={changes ? ["Example", "Screens"] : SCREEN_CRUMBS}
      path={ENTRY_PATHS.welcome}
      title="Welcome"
    />
  );
}
