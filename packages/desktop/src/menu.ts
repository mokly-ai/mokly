import type { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

/**
 * Retain Electron's platform menu and add the one shell action to its Help
 * menu. A build with the updater off shows the action disabled.
 */
export function installMenu(
  dependencies: {
    current(): Menu | null;
    item(options: MenuItemConstructorOptions): MenuItem;
  },
  updates: { available: boolean; check(): unknown },
): void {
  const menu = dependencies.current();
  const help = menu?.items.find(
    (item) => item.role === "help" || /help/i.test(item.label),
  )?.submenu;
  (help ?? menu)?.append(
    dependencies.item({
      label: "Check for updates",
      enabled: updates.available,
      click: () => void updates.check(),
    }),
  );
}
