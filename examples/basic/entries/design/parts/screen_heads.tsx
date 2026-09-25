import { ScreenHead, ViewSwitch } from "./shell.js";

/** The head band of the example Welcome screen with shared preview controls. */
export function WelcomeHead({
  active,
  changed = false,
}: {
  active: "both" | "desktop" | "mobile";
  changed?: boolean;
}) {
  return (
    <ScreenHead
      {...(changed ? { comparisons: true, status: "changed" as const } : {})}
      action={<ViewSwitch active={active} />}
      crumbs={["Example", "Screens"]}
      idChip="example-welcome"
      title="Welcome"
    />
  );
}
