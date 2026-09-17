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
the catalogue, prints its URL and watches your sources.

## Options

| Option            | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| `--config <path>` | Use an explicit `mokly.config` file                            |
| `--port <port>`   | Starting port; advances if occupied, `0` selects any free port |
| `--base <ref>`    | Git base ref used to find the branch point                     |
| `--watch`         | Watch your inputs; this is the default                         |
| `--no-watch`      | Serve one deterministic snapshot                               |
| `--debug-timings` | Report phase timings and catalogue counts on standard error    |

## The port

Serve starts at port `4173`. If that port, or a port you named, is already
taken, Mokly tries each following port until one is free. `--port 0` asks the
operating system for any free port. A watched server keeps the port it first
resolved, so its URL survives a restart.

## What it serves

Navigation and local controls are available immediately, and each preview is
rendered and validated when you ask for it. The complete generated output and
the Git comparison finish in the background while you read, and previews and
prop edits take priority over that work.

A watched server also notices Git ref changes, reloads the page when your
sources change and keeps your place. `--no-watch` starts the same way but does
not follow later edits.

## Access

While the local controls are active, every request must address
`localhost:<port>` or `127.0.0.1:<port>`. Forwarding through another local
port is supported; a request that arrives with another host is refused for the
whole catalogue. Rendering requests additionally require the exact matching
origin and the render token.
