---
title: "Build and host"
description: "Deploy a complete catalogue on a static file host."
section: "catalogue"
order: 5
---

## Build a static site

```shell
npx mokly build --no-changes --out .context/site --strict
```

The output contains the browser shell, all saved views, entry details, and
referenced resources. The output path resolves beside the configuration file.
It must stay inside the repository and outside protected source locations.
Git must ignore the output directory.

Omit `--no-changes` to include Changes. Use `--base origin/main` to select
that reference. The checkout must contain the common history with the base.
Build does not fetch history.

## Deploy the contents

Deploy the directory's contents at an HTTP(S) origin's document root. The host
needs correct MIME types, directory indexes, and query-insensitive file lookup.
It needs no Mokly process, source checkout, Node.js, or route rewrite.
A route such as `/view/home/` loads `view/home/index.html`.

Serve JSON as `application/json; charset=utf-8`. Add
`X-Content-Type-Options: nosniff` to the `static/` and `mokly-viewer/` paths.
Use `Cache-Control: no-cache` or validators for files that deployments replace.
Comparison generation paths are immutable and may use immutable caching.

Publish atomically or use immutable host deployments. Configure `404.html`
as the host's error document if supported. For a separate viewer origin,
follow the CORS rules in [static delivery](/docs/reference/export-delivery/).

## Browse the site

Readers can browse, search, inspect, and select saved viewports and schemes.
Component props are read-only. The static shell makes no live render or update
request. Comparison content loads when a reader selects a comparison.

The catalogue uses origin-root URLs. Use a dedicated origin rather than a
subpath. Open it through HTTP(S), rather than `file://`.

## Replace an earlier build

Mokly accepts missing or empty destinations and output with a valid ownership
marker. A replacement removes obsolete owned files. Unowned files cause a
refusal. Keep authored material outside the output directory.

A failed build preserves the earlier site when recovery is safe. If recovery
cannot restore it, the error names the retained backup. Check those paths
before removing an abandoned reservation.
