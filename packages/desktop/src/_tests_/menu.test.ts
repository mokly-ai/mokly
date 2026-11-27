import assert from "node:assert/strict";
import test from "node:test";

import type { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

import { installMenu } from "../menu.js";
import type { ButtonWindow } from "../window-buttons.js";

function item(options: MenuItemConstructorOptions): MenuItem {
  return { ...options } as unknown as MenuItem;
}

function menu(items: MenuItem[]): Menu {
  return {
    items,
    append: (input: MenuItem) => {
      items.push(input);
    },
  } as unknown as Menu;
}

let checks = 0;

/** Install the menu over the given top-level items and return the set menu. */
function install(
  items: MenuItem[],
  platform: NodeJS.Platform,
  available: boolean,
  focused: ButtonWindow | null = null,
): Menu {
  checks = 0;
  let installed: Menu | undefined;
  installMenu(
    {
      current: () => menu([...items]),
      item,
      build: menu,
      // Electron shows a menu as it is when it is set, so copy its lists then.
      set: (value: Menu) => {
        installed = menu(
          value.items.map((entry) =>
            entry.submenu
              ? ({
                  ...entry,
                  submenu: menu([...entry.submenu.items]),
                } as MenuItem)
              : entry,
          ),
        );
      },
      focusedWindow: () => focused,
    },
    {
      available,
      check: () => {
        checks++;
      },
    },
    platform,
  );
  assert.ok(installed, "the menu is set again");
  return installed;
}

for (const platform of ["darwin", "linux"] as const) {
  test(`the ${platform} menu keeps the platform items and uses the required zoom commands`, () => {
    const reload = item({ role: "reload" });
    const separator = item({ type: "separator" });
    const fullscreen = item({ role: "togglefullscreen" });
    const zoom = (["resetZoom", "zoomIn", "zoomOut"] as const).map((role) =>
      item({ role }),
    );
    const view = item({
      role: "viewMenu",
      label: "View",
      submenu: menu([reload, separator, ...zoom, fullscreen]),
    });
    const file = item({ role: "fileMenu" });
    let level = 0;
    const positions: unknown[] = [];
    const installed = install([file, view], platform, true, {
      on: assert.fail,
      isFullScreen: () => false,
      setWindowButtonPosition: (position: unknown) => {
        positions.push(position);
      },
      webContents: {
        on: assert.fail,
        getZoomFactor: () => 1.2 ** level,
        getZoomLevel: () => level,
        setZoomLevel: (value: number) => {
          level = value;
        },
      },
    });
    assert.equal(installed.items[0], file);
    const children = installed.items[1].submenu!.items;
    assert.equal(children[0], reload);
    assert.equal(children[1], separator);
    assert.equal(children[5], fullscreen);
    assert.equal(installed.items[1].label, "View");
    assert.deepEqual(
      children.slice(2, 5).map(({ role, label }) => ({ role, label })),
      platform === "darwin"
        ? [
            { role: undefined, label: "Actual Size" },
            { role: undefined, label: "Zoom In" },
            { role: undefined, label: "Zoom Out" },
          ]
        : zoom.map(({ role, label }) => ({ role, label })),
    );
    if (platform === "darwin") children[3].click();
    assert.deepEqual(
      positions,
      platform === "darwin" ? [{ x: 16, y: 19 }] : [],
    );
  });

  test(`the ${platform} menu adds a Help menu with the update check when the default menu has none`, () => {
    const file = item({ role: "fileMenu" });
    const installed = install([file], platform, true);
    assert.equal(installed.items[0], file);
    assert.equal(installed.items.length, 2);
    const help = installed.items[1];
    assert.equal(help.role, "help");
    assert.deepEqual(
      help.submenu!.items.map(({ label, enabled }) => ({ label, enabled })),
      [{ label: "Check for updates", enabled: true }],
    );
    help.submenu!.items[0].click();
    assert.equal(checks, 1);
  });

  test(`the ${platform} menu appends the update check to an existing Help menu`, () => {
    const learn = item({ label: "Learn More" });
    const helpItems = [learn];
    const installed = install(
      [item({ role: "help", label: "Help", submenu: menu(helpItems) })],
      platform,
      false,
    );
    assert.equal(installed.items.length, 1);
    assert.equal(installed.items[0].label, "Help");
    assert.deepEqual(helpItems, [learn]);
    assert.deepEqual(
      installed.items[0].submenu!.items.map(({ label, enabled }) => ({
        label,
        enabled,
      })),
      [
        { label: "Learn More", enabled: undefined },
        { label: "Check for updates", enabled: false },
      ],
    );
  });
}
