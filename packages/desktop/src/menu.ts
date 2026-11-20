import type { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

import { zoomMenuItem, type ButtonWindow } from "./window-buttons.js";

/**
 * Keep the platform menu and align the native Mac buttons on zoom.
 * Add the update action to Help and disable it when updates are unavailable.
 */
export function installMenu(
  dependencies: {
    current(): Menu | null;
    item(options: MenuItemConstructorOptions): MenuItem;
    build(items: MenuItem[]): Menu;
    set(menu: Menu): void;
    focusedWindow(): ButtonWindow | null;
  },
  updates: { available: boolean; check(): unknown },
  platform: NodeJS.Platform,
): void {
  let menu = dependencies.current();
  if (!menu) return;
  if (platform === "darwin") {
    menu = dependencies.build(
      menu.items.map((item) => {
        if (item.role?.toLowerCase() !== "viewmenu" || !item.submenu)
          return item;
        return dependencies.item({
          role: item.role,
          label: item.label,
          submenu: dependencies.build(
            item.submenu.items.map((child) => {
              const zoom = zoomMenuItem(child.role, dependencies.focusedWindow);
              return zoom ? dependencies.item(zoom) : child;
            }),
          ),
        });
      }),
    );
  }
  const help = menu.items.find(
    (item) => item.role === "help" || /help/i.test(item.label),
  )?.submenu;
  (help ?? menu).append(
    dependencies.item({
      label: "Check for updates",
      enabled: updates.available,
      click: () => void updates.check(),
    }),
  );
  if (platform === "darwin") dependencies.set(menu);
}
