import type { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

import { zoomMenuItem, type ButtonWindow } from "./window-buttons.js";

/** Retain the platform menu; Mac zoom commands also align the native buttons. */
export function installMenu(
  dependencies: {
    current(): Menu | null;
    item(options: MenuItemConstructorOptions): MenuItem;
    build(items: MenuItem[]): Menu;
    set(menu: Menu): void;
    focusedWindow(): ButtonWindow | null;
  },
  check: () => void,
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
    dependencies.item({ label: "Check for updates", click: check }),
  );
  if (platform === "darwin") dependencies.set(menu);
}
