---
title: "Configure"
description: "Tell Mokly where your screens live and where the catalogue is written."
section: "start"
order: 2
---

## Add the config file

Create `mokly.config.ts` at the root of the repository and export the result
of `defineConfig`. Two things are required: where your entry modules live, and
`mockupsDir`, the folder that receives the generated catalogue.

Entry modules can sit beside the components and screens they describe. List
one or more `entries` globs, relative to the repository root. Every matched
regular file is an entry module; the glob defines the complete shape. The
recommended pattern below selects the conventional `.mockup.ts` and
`.mockup.tsx` names.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  entries: ["src/**/*.mockup.{ts,tsx}"],
  mockupsDir: "docs/mockups/generated",
});
```

If you would rather keep all entry modules in one folder, name it with
`entriesDir` instead. It is shorthand for
`<folder>/**/*.mockup.{ts,tsx}`, and you use one field or the other, never both.

```ts
export default defineConfig({
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
});
```

Every folder path in the config is relative to the config file itself, the
`entries` globs are relative to the repository root, and every one of them
stays inside the repository. A glob that matches no entry module is an error,
so a typo cannot quietly produce an empty catalogue.

## Add your theme

Screens usually need your product's CSS and your own React providers. Keep
both in the repository: list stylesheets per route, and point `renderer` at a
module that wraps a screen in your theme.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  entries: ["src/**/*.mockup.{ts,tsx}"],
  mockupsDir: "docs/mockups/generated",
  renderer: "docs/mockups/renderer.tsx",
  stylesheets: [{ match: "screens/*.html", stylesheets: ["app.css"] }],
});
```

Keep public assets such as `app.css` inside `mockupsDir` so the catalogue can
serve them. Entry modules and the helpers they import are never served, even
when a glob reaches into a folder below `mockupsDir`.

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
