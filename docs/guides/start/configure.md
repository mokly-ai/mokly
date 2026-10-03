---
title: "Configure"
description: "Tell Mokly where your specs live and where the catalogue is written."
section: "start"
order: 2
---

## Add the config file

Create `mokly.config.ts` at the root of the repository and export the result
of `defineConfig`. One field is required: `mockupsDir`, the folder that
receives the generated catalogue. Everything Mokly reads comes from a `specs`
folder beside the config file unless you say otherwise.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  mockupsDir: "specs/generated",
});
```

Mokly scans `specs` for two kinds of file: entry modules named
`*.mockup.ts` or `*.mockup.tsx`, which define screens, pages, flows and
components in TypeScript, and Markdown files, which stay protected and watched
but do not render yet. The folder you put an entry module in is its folder in
the catalogue: `specs/account/billing/invoice.mockup.tsx` produces
`account/billing/invoice`. Use `definePage` in `specs/account/index.mockup.ts`
for a complete HTML page at `account`.

## Choose your own roots

`roots` replaces the default when your files live elsewhere or in several
places. Each root names a directory, relative to the config file, and may
narrow the files it reads, prefix the paths it produces, or hide directory
names from them.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  mockupsDir: "specs/generated",
  roots: [{ dir: "specs" }, { dir: "packages/ui/src", path: "components" }],
});
```

The second root puts a component library in the catalogue under
`components`, so `packages/ui/src/button/index.mockup.tsx` becomes
`components/button` while its registration stays beside the component code.
To keep mockups next to product code without a prefix, name the directory
that holds them as transparent: with
`{ dir: "src/features", transparent: ["__mockups__"] }`, the file
`src/features/checkout/__mockups__/summary.mockup.tsx` becomes
`checkout/summary`.

A root must exist and must match at least one file, so a typo cannot quietly
produce an empty catalogue, and a root cannot be `mockupsDir` itself. Every
path in the config is relative to the config file and stays inside the
repository.

## Add your theme

Screens usually need your product's CSS and your own React providers. Keep
both in the repository: list stylesheets per entry, and point `renderer` at a
module that wraps a screen in your theme.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  mockupsDir: "specs/generated",
  renderer: "specs/renderer.tsx",
  stylesheets: [{ match: "**/index.html", stylesheets: ["app.css"] }],
});
```

A stylesheet rule matches an entry's route, `<path>/index.html`, so
`account/**/index.html` reaches everything under `account`. Keep public assets
such as `app.css` inside `mockupsDir` so the catalogue can serve them. Entry
modules, documents and the helpers they import are never served, even when a
root reaches into a folder below `mockupsDir`.

## Where the config is found

Mokly walks up from the current directory looking for `mokly.config.ts`,
`.mts`, `.js` or `.mjs`. Pass `--config` after the command to name one
explicitly:

```shell
npx mokly build --config tools/mokly.config.ts
```

## Next

Author a screen, then build the catalogue. Every field of the configuration
is described under Authoring.
