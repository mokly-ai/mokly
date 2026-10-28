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

| Option                      | Meaning                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `--config {path}`           | Load a JSON configuration file. Omission searches upward.            |
| `--port {port}`             | Select the starting port. `0` selects any free port.                 |
| `--base {ref}`              | Override `review.base`, whose default is `origin/main`.              |
| `--base-install-scripts`    | Run lifecycle scripts during base dependency installation.           |
| `--no-base-install-scripts` | Keep lifecycle scripts disabled during base dependency installation. |
| `--watch`                   | Watch your inputs. This is the default.                              |
| `--no-watch`                | Serve one snapshot without watching files.                           |
| `--open`                    | Open the served URL in your default browser.                         |
| `--sidecars {count}`        | Set the positive JavaScript worker count.                            |
| `--debug-timings`           | Select plain output and report timing records.                       |

## The port

Serve starts at port `4173`. If that port, or a port you named, is already
taken, Mokly tries each following port until one is free. `--port 0` asks the
operating system for any free port. A watched server keeps the port it first
resolved, so its URL survives a restart.

## What it serves

Every entry answers at `/view/{path}/`, and `/view/{path}` or
`/view/{path}/index.html` opens the same page. Navigation and local controls
are available immediately, and each preview is rendered and validated when you
ask for it. The complete generated output and
the Git comparison finish in the background while you read, and previews and
prop edits take priority over that work.

Rendered documents and generated resources answer under
`/static/mokly-generated/`. That prefix is a route, not a folder in your
repository. Only the authored files that the catalogue references, such as
images, answer at `/static/{repository-relative path}`.

Serve keeps every result in memory and writes nothing into your repository.
Use [build](/docs/cli/build/) to write the catalogue as files. A watched
server that fails to rebuild keeps serving the last good catalogue.

A watched server also notices Git ref changes, reloads the page when your
sources change and keeps your place. `--no-watch` starts the same way but does
not follow later edits. If an imported stylesheet asset changes, its request
fails and the terminal names the asset. Restart Serve or use watching to
load the edited asset.

When the complete generated output finishes, Serve prints that generation's
build warnings once on standard error. Previews you open afterwards are not
reported again, and Serve never stops for a warning.
`--strict` is not a Serve option; use it with `build` or `publish` when warnings must fail automation.

## Access

While the local controls are active, every request must address
`localhost:{port}` or `127.0.0.1:{port}`. Forwarding through another local
port is supported; a request that arrives with another host is refused for the
whole catalogue. Rendering requests additionally require the exact matching
origin and the render token.

Warnings name the page or authored input that needs attention. Serve reports
each warning once for its current build attempt before Catalogue ready. A
failed attempt reports its collected warnings before its error. Late warnings
from older attempts stay silent. New warnings from temporary component edits
use the current attempt and never repeat an already reported warning.
