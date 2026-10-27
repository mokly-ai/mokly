---
title: "Configure"
description: "Tell Mokly which authored files belong to the catalogue."
section: "start"
order: 2
---

## Point Mokly at your files

Create `mokly.config.json` in the repository root. An empty configuration
uses `specs` as its source root.

```json
{}
```

Mokly searches upward from the current directory for this file. Use
`--config path/to/mokly.config.json` to select another JSON file.
Filesystem paths in the configuration are relative to that file.

## Add another root

Each root selects authored files and supplies their catalogue path prefix.

```json
{
  "$schema": "./node_modules/@mokly/mokly/config.schema.json",
  "roots": [
    { "dir": "specs" },
    { "dir": "packages/ui/src", "path": "components" }
  ],
  "colorSchemes": ["light", "dark"]
}
```

The default file set includes HTML screens, components, and pages, Markdown
documents, YAML use cases, TypeScript mockup modules (`.mockup.ts` and
`.mockup.tsx`), and Storybook stories.
Each matched file belongs to one root. A path override in its metadata can
replace its file-derived catalogue path.

Read [Config](/docs/authoring/config/) for every field.
Continue with [Your first screen](/docs/start/your-first-screen/).
