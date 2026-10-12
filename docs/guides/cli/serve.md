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

| Option            | Meaning                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `--config <path>` | Use an explicit `mokly.config` file                                 |
| `--port <port>`   | Starting port; advances if occupied, `0` selects any free port      |
| `--base <ref>`    | Git base ref used to find the branch point                          |
| `--watch`         | Watch your inputs; this is the default                              |
| `--no-watch`      | Serve one deterministic snapshot                                    |
| `--build`         | Write `mokly-generated/` after each successful complete compilation |
| `--open`          | Open the served URL in your default browser                         |
| `--debug-timings` | Report phase timings and catalogue counts on standard error         |

## The port

Serve starts at port `4173`. If that port, or a port you named, is already
taken, Mokly tries each following port until one is free. `--port 0` asks the
operating system for any free port. A watched server keeps the port it first
resolved, so its URL survives a restart.

## What it serves

Every entry answers at `/view/<path>/`, and `/view/<path>` or
`/view/<path>/index.html` opens the same page. Navigation and local controls
are available immediately, and each preview is rendered and validated when you
ask for it. The complete generated output and
the Git comparison finish in the background while you read, and previews and
prop edits take priority over that work.

Generated pages appear under `/static/mokly-generated/` in the served URL; only
their referenced authored assets are served at `/static/<catalogue path>`.
Serve normally writes nothing to `mokly-generated/`, even after background work.
Pass `--build` to write after each successful complete compilation. With
`--build --no-watch`, Serve writes once after the initial compilation.
Failures preserve the last-good output and browsing; the parent process,
never the HTTP child, performs opted-in writes.

A watched server also notices Git ref changes, reloads the page when your
sources change and keeps your place. `--no-watch` starts the same way but does
not follow later edits.

When the complete generated output finishes, Serve prints that generation's
build warnings once on standard error. Previews you open afterwards are not
reported again, and Serve never stops for a warning.
`--strict` is not a Serve option; use it with `build`, `check`, `export`, or
`publish` when warnings must fail automation.

## Access

While the local controls are active, every request must address
`localhost:<port>` or `127.0.0.1:<port>`. Forwarding through another local
port is supported; a request that arrives with another host is refused for the
whole catalogue. Rendering requests additionally require the exact matching
origin and the render token.

Warnings name the page or authored input that needs attention. Serve reports
each warning once for its current build attempt before Catalogue ready. A
failed attempt reports its collected warnings before its error. Late warnings
from older attempts stay silent. New warnings from temporary component edits
use the current attempt and never repeat an already reported warning.
