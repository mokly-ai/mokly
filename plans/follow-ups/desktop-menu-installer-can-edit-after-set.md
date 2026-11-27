# Desktop menu installer can edit after set

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from branch `calummoore/check-updates-ef6i`, the
  wider fix of review finding 3.
- **Location:** `packages/desktop/src/menu.ts:23`,
  `packages/desktop/src/main.ts:152`,
  `packages/desktop/src/lifecycle.ts:109`,
  `packages/desktop/src/_tests_/menu.test.ts:38`,
  `packages/desktop/README.md:272`.
- **Reason:** The fix moves the desktop startup wiring, and the review
  finding that found the class needed only a test change to close its gap.

- **Terms:**
  - **Electron:** The framework that runs the Mokly Cloud desktop shell
    under `packages/desktop` and draws its native menus.
  - **Application menu:** The menu bar of the desktop app. Electron shows
    it from `Menu.setApplicationMenu`.
  - **Check for updates:** The menu item that starts a manual update check.
    It lives in the Help menu.
  - **Set fake:** The fake of `Menu.setApplicationMenu` that the `install`
    helper of `packages/desktop/src/_tests_/menu.test.ts` passes to
    `installMenu`.
  - **Electron smoke:** The Playwright run in `cloud-desktop`, which
    launches the real app. Its global setup,
    `packages/desktop/src/_tests_/global-setup.ts:35`, calls
    `expectShellSettings` in `packages/desktop/src/_tests_/shell.ts`, which
    checks the menu.
- **Background:** `installMenu` in `packages/desktop/src/menu.ts` runs once
  at startup, from `startDesktop` in `packages/desktop/src/lifecycle.ts`.
  It reads Electron's default menu and swaps the Mac zoom items. It adds
  **Check for updates** to the Help menu, and it adds a Help menu first
  when the default menu has none, as in Electron 44. Then it builds the new
  menu and sets it. `main.ts` passes it Electron's
  `Menu.getApplicationMenu`, `new MenuItem`, `Menu.buildFromTemplate`,
  `Menu.setApplicationMenu` and `BrowserWindow.getFocusedWindow` as
  dependencies. Electron draws a menu as it is when it is set. Items that
  code adds to the menu afterwards do not show on Linux.
- **Problem:** `installMenu` holds the menu objects that it sets, so a
  later edit can still change the menu after `set`. The set fake copies
  the top-level list, and the submenu list of each top-level item that has
  a submenu, when it is called. So the tests catch a pushed item and a
  replaced submenu after `set`. Two late edits still pass every test: a
  submenu given to a top-level item that had none, and a change to a child
  item, such as its `enabled` state. The Electron smoke and
  `packages/desktop/scripts/packaged-smoke.mjs:135` both read
  `Menu.getApplicationMenu()`, which returns the same changed object, so
  neither can catch a late edit.
- **Impact if no action:** A later edit can hide or break **Check for
  updates**, or another menu item, on Linux while every check passes.
- **Root question:** How can the menu code be unable to change the menu
  after Electron shows it?
- **Options:**
  - **A.** Make `installMenu` a pure function that takes the default menu
    items, the update state, the platform and the focused-window getter,
    and returns the template of the new menu. Remove its `item`, `build`
    and `set` dependencies. `main.ts` then calls
    `Menu.setApplicationMenu(Menu.buildFromTemplate(template))` in one
    place. `Menu.buildFromTemplate` accepts existing `MenuItem` objects,
    so the template can reuse the default items. The tests check the
    returned template, and the copying set fake goes. Update the
    `installMenu` sentence of `packages/desktop/README.md` under
    `### Key Code`. The Electron smoke covers the one line in `main.ts`.
    Effort: Medium.
  - **B.** Keep the dependencies, but pass one `install(items)` function
    that builds and sets the menu, so `installMenu` never receives the
    built menu. The submenus that `build` returns can still change
    afterwards. Effort: Medium.
  - **C.** Read the native menu through the Linux accessibility API in
    the Electron smoke and require **Check for updates** under Help. This
    adds native test tooling to CI. Effort: Large.
- **Left out:** Reading the application menu again after startup returns
  the same changed object, so it cannot tell. Freezing the lists in the
  set fake throws on a push but not on a changed child item, and option A
  makes it unneeded.
- **Wider fix:** A. It removes every reference to the set menu from the
  logic, so no edit after `set` is possible.
- **Previous examples:** Before commit `b8528150d`, `installMenu` appended
  **Check for updates** to Electron's menu on Linux after the menu was
  set, so the item never showed. The Electron smoke passed, because it
  read the same changed menu object.
- **Recommendation:** A. It removes the class in `menu.ts`, `main.ts` and
  the menu tests, and the tests no longer need a copying fake.
- **Action:** fix after merge, apply A, because it changes the startup
  wiring that the branch did not need to touch.
