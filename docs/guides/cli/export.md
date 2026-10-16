---
title: "Build for static hosting"
description: "Write the files that a static HTTP host needs."
section: "cli"
order: 4
---

## Create the site

```shell
npx mokly build --no-changes --strict --out .context/site
```

The [build command](/docs/cli/build/) writes the whole catalogue.
Deploy its contents as the document root of an HTTP(S) origin. The host
serves directory indexes, files, and their correct MIME types.

A relative output path resolves beside the JSON configuration. Use a missing
or empty directory inside the repository. Keep it ignored by Git. Mokly can
replace an earlier output that has a valid ownership marker.

Omit `--no-changes` when the site needs Changes. Fetch sufficient history for
the configured base before running the command.

## Host settings

Configure revalidation and `X-Content-Type-Options: nosniff`. The site includes
`404.html` for hosts that support a custom error document. Deploy atomically
so clients do not read files from different builds.

See [Build and host](/docs/catalogue/export-and-host/) for the full host setup.
Use [Publish](/docs/cli/publish/) when a catalogue receiver should store and
host the files.
