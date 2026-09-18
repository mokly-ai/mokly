---
title: "Serve"
description: "Open the catalogue in your browser while you work."
section: "start"
order: 5
---

## Start the server

```shell
npx mokly
```

`mokly` on its own is `mokly serve`. It starts at port `4173`, prints the URL
and watches your sources. Navigation and previews are available immediately;
each screen is rendered when you open it, and the complete build and the
comparison with your Git base finish in the background.

To open the URL in your default browser as soon as the server is ready, run:

```shell
npx mokly --open
```

## Choose a port

If `4173` is taken, Mokly tries each following port until one is free. Ask the
operating system for any free port with `--port 0`, or name your own:

```shell
npx mokly serve --port 4300
```

A watched server keeps the port it resolved, so the URL stays the same across
restarts.

## Work without watching

```shell
npx mokly serve --no-watch
```

That serves one deterministic snapshot: the same fast start, without picking
up later edits.

## What you can do there

Browse the catalogue by collection, search it, switch viewport and color
scheme, open the details of a screen and compare a changed screen with its
base. The Catalogue section describes each of those.
