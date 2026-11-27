import type { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

import { zoomMenuItem, type ButtonWindow } from "./window-buttons.js";

export interface MenuDependencies {
  current(): Menu | null;
  item(options: MenuItemConstructorOptions): MenuItem;
  build(items: MenuItem[]): Menu;
  set(menu: Menu): void;
  focusedWindow(): ButtonWindow | null;
}

const isHelp = (item: MenuItem) =>
  item.role?.toLowerCase() === "help" || /help/i.test(item.label ?? "");

/**
 * Keep the platform menu and align the native Mac buttons on zoom.
 * Add the update action to Help and disable it when updates are unavailable.
 * The default menu has no Help menu, so one is added when it is missing.
 * Electron ignores items added to a menu after it is set, so the menu is
 * always built again and set.
 */
export function installMenu(
  dependencies: MenuDependencies,
  updates: { available: boolean; check(): unknown },
  platform: NodeJS.Platform,
): void {
  const menu = dependencies.current();
  if (!menu) return;
  const items = menu.items.map((item) => {
    if (
      platform !== "darwin" ||
      item.role?.toLowerCase() !== "viewmenu" ||
      !item.submenu
    )
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
  });
  const check = dependencies.item({
    label: "Check for updates",
    enabled: updates.available,
    click: () => void updates.check(),
  });
  const index = items.findIndex(isHelp);
  const help = items[index];
  const helpItem = dependencies.item({
    role: "help",
    ...(help?.label ? { label: help.label } : {}),
    submenu: dependencies.build([...(help?.submenu?.items ?? []), check]),
  });
  if (index === -1) items.push(helpItem);
  else items[index] = helpItem;
  dependencies.set(dependencies.build(items));
}
