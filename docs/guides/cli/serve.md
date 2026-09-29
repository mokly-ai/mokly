---
title: "serve"
description: "Build and serve the catalogue with on-demand previews and comparisons."
section: "cli"
order: 1
---

## Usage

```shell
npx mokly serve
```

`serve` is the default command, so `npx mokly` does the same thing. It starts
the catalogue, prints its URL and watches your sources. Add `--open` to open
that URL in your default browser as soon as the server is ready.

## Options

| Option                          | Meaning                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `--config <path>`               | Use an explicit `mokly.config` file                            |
| `--port <port>`                 | Starting port; advances if occupied, `0` selects any free port |
| `--interactive-port <port>`     | Live preview port, or `0` to select any free port              |
| `--interactive-origin <origin>` | Live origin for different browser-facing host names or ports   |
| `--strict-port`                 | Fail instead of advancing either requested Serve port          |
| `--base <ref>`                  | Git base ref used to find the branch point                     |
| `--watch`                       | Watch your inputs; this is the default                         |
| `--no-watch`                    | Serve one deterministic snapshot                               |
| `--open`                        | Open the served URL in your default browser                    |
| `--debug-timings`               | Report phase timings and catalogue counts on standard error    |

## The port

Serve starts at port `4173`. If that port, or a port you named, is already
taken, Mokly tries each following port until one is free. `--port 0` asks the
operating system for any free port. A watched server keeps the port it first
resolved, so its URL survives a restart.

When the config selects `interactive: "serve"`, `--interactive-port` chooses
the separate Live origin's starting port with the same numeric rules. Without
it, Live starts at the resolved app port plus one. `--strict-port` makes an
occupied app or Live port fail startup instead of advancing; a watched server
retains both resolved ports across restarts. Serve prints the Live origin on a
second startup line. If the app resolves to port 65535 and no Live port was
named, Live asks the operating system for a free port because no next port
exists; this also applies under `--strict-port`.

Use
`--interactive-origin` when Mokly must advertise a different canonical
HTTP(S) origin because a forwarding layer changes browser-facing host names or
port numbers. The derived local Live origin, Host checks and frame policy use
Serve's actual socket ports, so an override is required even when forwarding
changes only a port number.
It cannot contain credentials, a path, query, or fragment, does not change the
loopback bind, and must route to that listener. Mokly accepts exactly its Host
authority in addition to local loopback Hosts; forwarded headers alone grant
nothing. Because the forwarded app origin is not known, this explicit mode
allows HTTP(S) frame ancestors while the frame handshake still pins the exact
app origin. Both interactive options are rejected while interactive views are
off.

## What it serves

Navigation and local controls are available immediately, and each preview is
rendered and validated when you ask for it. The complete generated output and
the Git comparison finish in the background while you read, and previews and
prop edits take priority over that work.

A watched server also notices Git ref changes, reloads the page when your
sources change and keeps your place. `--no-watch` starts the same way but does
not follow later edits.

With `interactive: "serve"`, screens and saved component variants gain a
Static/Live control in the view toolbar, except those that opt out with
`interactive: false`, which keep the toolbar without it and always show Static.
Live runs the same view in the browser so buttons respond, menus open and local
state works; the announced second origin prepares it the first time you choose
Live, and links inside it open their destination in the catalogue. Inspection
and prop editing stay in Static, so switching to Live discards unsaved prop
edits. The choice follows you between views, including past opted-out ones,
and survives watched reloads, and opening the page again starts in Static. Build, Check, export, publication, Changes, and comparisons
remain static.

## When a change can't be loaded

If a saved change fails to load, for example because of a syntax error or a
module that can no longer be found, a watched server keeps serving the last
version that loaded. Every page then shows a notice under the top bar: **Your
latest changes couldn’t be loaded. You’re seeing the last working version.**
Static and Live previews keep working on that version, so you can carry on
browsing and comparing.

Choose **Show details** to read the error. Paths inside your repository appear
relative to it, and other absolute paths appear as `<absolute path>`; the
terminal reports the same error in full. Fix the source and save again: the
catalogue reloads with your change and the notice goes away. If another save
fails first, the notice stays and its details show the newest error. A screen
reader hears the notice once for each new failure, not on every reload.

While a change takes more than a second to load, **Updating…** appears beside
the search field; quicker updates finish before it would show. Unwatched
servers, exported catalogues and published catalogues never show the notice
or the progress.

## Access

While the local controls are active, every request must address
`localhost:<port>` or `127.0.0.1:<port>`. Forwarding through another local
port is supported; a request that arrives with another host is refused for the
whole catalogue. Rendering requests additionally require the exact matching
origin and the render token.

The Live listener applies the same loopback Host rule and serves only Live
documents, confined public assets, generation bundles, diagnostics, and the
inspector. It does not serve the shell, catalogue JSON, controls, review,
comparisons, or uploads. Local Live documents allow the app opened as either
`localhost` or `127.0.0.1`; an explicit `--interactive-origin` admits only that
additional Live authority.
