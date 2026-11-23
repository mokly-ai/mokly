# Viewer Chrome: Account Menu

Status: The account menu that the avatar trigger opens, Theme on the device and the account rows of More are not built yet. [Milestone 13](../../../plans/canvas-redesign-milestones-viewer.md#milestone-13-cloud-viewer-chrome) builds them.

This is the account sub-contract of [Viewer chrome](./viewer-chrome.md): the
`account` trigger, the account menu that it opens, the Theme choice in that
menu, and the account rows that end the compact **More** menu. Their
compositions are in [Viewer compositions](./folio-viewer.md#compositions).

## Account Trigger

The full bar ends with the `account` trigger, which draws the reader's avatar:
their initials in a circle. Every account is created by an email address, so a
reader who has not set a display name is named by their address. The
trigger's accessible name and its tooltip are the reader's whole display name,
or their whole address when they have set none. The initials are a picture:
assistive technology skips them, and the trigger keeps the name that a screen
reader announces. Decision: the trigger draws the avatar rather than the name,
because an avatar keeps one width for every reader, so a long name or address
never takes the publication's room in the bar.

The compact bar has no `account` trigger: **More** ends with the account rows,
as [More](#more) defines.

## Account Menu

The `account` trigger opens the account menu. Its rows, from the top:

- **Who is signed in**: the avatar, the reader's name and, beneath it, their
  address. A reader with no display name is named by the address, once.
- **Theme**, with **Light** and **Dark**, as [Theme](#theme) defines.
- **Settings**, which opens the [settings dialog](./settings-dialog.md) on its
  index, because it names no pane.
- **Docs** and **Changelog**, which open the public site's `/docs/` and
  `/changelog/`, as [Docs and Changelog](#docs-and-changelog) defines.
- **Sign out**, which ends the session.

Who is signed in and Theme head the menu. Settings, Docs, Changelog and Sign
out are its items, and choosing one closes the menu before the dialog opens,
the site page opens or the session ends. When Sign out fails, the
[settings dialog](./settings-dialog.md#sections-and-panes) opens on the
Account pane, which shows the failure. Theme is a choice, not an item:
choosing Light or Dark applies the scheme and keeps the menu open, so the
reader sees the result and can change it back. Decision: Settings stays the
first item and Sign out the last, with Docs and Changelog between them, rather
than Docs and Changelog first, so a menu opened from the keyboard starts on the
account's own action and not on a row that leaves the app.

## Docs And Changelog

**Docs** and **Changelog** leave the app for the public site, so each carries
the external glyph in place of a glyph of its own. In a browser tab, each
opens its page in the same tab, as
[Outbound links](./web-product-shell.md#outbound-links) defines. In the
desktop app, each opens its page in the system browser, as
[Desktop application](./desktop-app.md#navigation) defines, and the window
keeps the viewer.
[Marketing site](./marketing-site.md#links-from-the-app-to-the-site) says why
the menu carries these two links and not Home.

## Theme

Theme sets the app's scheme on this device. Before the reader chooses, the app
follows their system preference, also when it changes while the app is open,
and is light when the browser states none. Theme then shows that scheme as
selected. A choice applies at once to the whole app: the cloud chrome, the
panels, the settings dialog, and the package interface through the `theme`
that [Viewer host](./viewer-host.md#package-host) passes. The device keeps the
choice, not the account, so each browser keeps its own. The choice holds over
the system preference until the reader chooses again. Theme never changes the
scheme of the preview documents, which stays the reader's selection.

`mokly serve` keeps its own Appearance control in its top bar, because the
standalone shell has no account menu, as
[Viewer appearance](../mokly-viewer-appearance.md) defines.

## More

On compact widths, **More** holds the project, History and Share, each with
its glyph, then a divider, then the same account rows as the account menu: who
is signed in, Theme, Settings, Docs, Changelog and Sign out. More holds no
Search, because the package keeps its own search control in the compact bar.
The project, History and Share open the same panels as their full-bar
triggers.

## Menus

The account menu and **More** are menus, not panels: opening one changes no
address and adds no history entry, and neither is a `panel` value of
[Viewer address state](./viewer-address-state.md). On a pointer viewport, each
opens as a non-modal popover under its trigger, and the viewer beneath stays
the page, with its own landmark and heading. On a touch viewport, **More**
opens as the registered panel's bottom sheet, titled More, with Close, over the
inert viewer, exactly as a panel opens: the sheet takes the document's `main`
landmark and `h1`. Escape and a press outside dismiss a menu, and so does the
sheet's Close; each returns focus to the menu's trigger. In the desktop app,
choosing Docs or Changelog also returns focus to the menu's trigger, because
the window keeps the viewer. When a settings dialog that a menu's Settings
opened closes, focus returns to that menu's trigger: the avatar on the full
bar, or **More** while the compact bar groups the account rows.
