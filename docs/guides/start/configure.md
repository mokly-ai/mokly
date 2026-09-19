---
title: "Configure"
description: "Tell Mokly where your screens live and where the catalogue is written."
section: "start"
order: 2
---

## Add the config file

Create `mokly.config.ts` at the root of the repository and export the result
of `defineConfig`. Two fields are required: `entriesDir`, the folder holding
your entry modules, and `mockupsDir`, the folder that receives the generated
catalogue.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
});
```

Every path in the config is relative to the config file itself, and every one
of them stays inside the repository root.

## Add your theme

Screens usually need your product's CSS and your own React providers. Keep
both in the repository: list stylesheets per route, and point `renderer` at a
module that wraps a screen in your theme.

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  colorSchemes: ["light", "dark"],
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
  renderer: "docs/mockups/renderer.tsx",
  stylesheets: [{ match: "app/**/*.html", stylesheets: ["app.css"] }],
});
```

Keep public assets such as `app.css` inside `mockupsDir` so the catalogue can
serve them.

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
