import type { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

/** Retain Electron's platform menu and add the one shell action to its Help menu. */
export function installMenu(
  dependencies: {
    current(): Menu | null;
    item(options: MenuItemConstructorOptions): MenuItem;
  },
  check: () => void,
): void {
  const menu = dependencies.current();
  const help = menu?.items.find(
    (item) => item.role === "help" || /help/i.test(item.label),
  )?.submenu;
  (help ?? menu)?.append(
    dependencies.item({ label: "Check for updates", click: check }),
  );
}
