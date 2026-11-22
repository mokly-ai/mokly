import assert from "node:assert/strict";
import test from "node:test";

import type { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

import { installMenu } from "../menu.js";

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
    const help = item({ role: "help", submenu: menu([]) });
    const original = menu([file, view, help]);
    let installed = original;
    let checks = 0;
    let level = 0;
    const positions: unknown[] = [];
    installMenu(
      {
        current: () => original,
        item,
        build: menu,
        set: (value: Menu) => {
          installed = value;
        },
        focusedWindow: () => ({
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
        }),
      },
      {
        available: true,
        check: () => {
          checks++;
        },
      },
      platform,
    );
    assert.equal(installed.items[0], file);
    assert.equal(installed.items[2], help);
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
    assert.equal(help.submenu!.items[0].label, "Check for updates");
    help.submenu!.items[0].click();
    assert.equal(checks, 1);
    if (platform === "darwin") children[3].click();
    assert.deepEqual(
      positions,
      platform === "darwin" ? [{ x: 16, y: 19 }] : [],
    );
  });
}
