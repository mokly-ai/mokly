# Desktop Bundle And Origin

This is the bundle and window sub-contract of
[Desktop application](./desktop-app.md): the privileged scheme and the
desktop origin from which the shell serves the web export, the renderer
settings and the window lifecycle.

## Origin And Export

Before the application is ready, the shell registers the privileged scheme
`mokly-app` as standard and secure, with fetch and CORS support. The page
origin is `mokly-app://desktop`, the **desktop origin**; the servers, the
web application and the shell pin the same literal
through a shared fixture. The shell owns one main window and loads
`mokly-app://desktop/dashboard` at start, which resolves to the reader's last
project or to account entry exactly as [Navigation](./product-navigation.md)
describes.

The scheme handler serves the export with the app server's rules: an existing
file resolves from the export root, an extensionless path falls back to
`index.html`, a missing asset is 404, a path that escapes the root or follows a symlink outside it is 404,
malformed percent escapes return 400, and only GET and HEAD are answered.
The app server returns 400 for an escaping path; the shell uses 404 so its
response does not disclose whether an outside file exists. Every response carries
`X-Content-Type-Options: nosniff` and the app server's
`Content-Security-Policy`, with `'self'` now the desktop origin;
nothing is served over a network, so there are no cache headers, and the
`/_health` and `/_config` routes do not exist.

The two baked origins stay the hosted ones. The public app origin supplies the
addresses the product shows. [Outbound links](./web-product-shell.md#outbound-links)
defines the site-link origins and the app-origin fallback. The page recognizes
the shell by its own location protocol, `mokly-app:`. Inside the shell the app
signs in through the browser and opens GitHub setup on the web, as
[Desktop application](./desktop-app.md#sign-in) defines.

Renderer settings are fixed: context isolation on, sandbox on, Node
integration off, web security on, no `webview` tag, no insecure content, and
no preload script until [local mode](./desktop-app.md#local-mode) adds its one
bridge. The shell grants
`clipboard-sanitized-write` only to the main frame on `mokly-app://desktop`.
Both permission requests and checks use this rule. All other requests and
checks are denied, including clipboard reads and requests from catalogue
frames or same-origin subframes.

## Window Lifecycle

Offline, the page loads and renders. The session read then fails, and the
application shows its session error state with **Try again**, exactly as it
does in a browser when the API is unreachable; the local-mode plan adds the
path that reaches the viewer with a local source and no session.

The shell takes the single-instance lock, so a second launch hands its
arguments to the running instance. It remembers the window's size and
position. Closing the window on macOS keeps the application running and the
Dock icon reopens it; on Linux closing the window quits. The menu is the
platform default plus **Check for updates**; there is no shell settings
surface, because [Settings dialog](./settings-dialog.md) owns settings and the
shell has nothing to configure. It shows no notifications, because they need
an event channel that the cloud does not provide.

Both reopen events, Dock activation and a second launch, focus an existing
window or create one and load the dashboard. A
[sign-in handoff](./desktop-app.md#sign-in-handoff) can replace the initial
dashboard load without quitting the app. Navigation failures warn and leave the process
running; configuration and initialization failures still stop startup.
Main-process warnings emit only a fixed operation label and a safe error code.
They omit raw messages, URLs, stacks, causes and arbitrary error fields so a
callback credential cannot enter the log.
