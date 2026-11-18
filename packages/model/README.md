# @mokly/model

`@mokly/model` holds the catalogue rules and the generated types that Mokly's
browser code shares: the path and link grammar, the static paths of current
generated documents, the route and the id grammar of temporary renders, the
directory names of the viewer namespace, and the TypeScript types that the
Rust model crate generates. Each rule has one home here, so the Browse shell
and the frame code read the same rule. A host that embeds a catalogue uses
`@mokly/viewer`, which depends on this package at the exact shared version and
re-exports the rules that its `./data` entry lists.

## Responsibilities

- The path grammar of the path contract, such as `isEntryPath`, the link and
  fragment grammar of the authoring links contract, such as
  `parseLogicalTarget`, and the `isSafeRepositoryPath` check of a repository
  path.
- `currentDocumentPath`, the static path of a current generated document, and
  its inverse route `currentDocumentRoute`, which
  [frame mapping](../../docs/protocol/mokly-artifact-paths.md#frames-and-reverse-mapping)
  uses.
- `isSafeCatalogueRoute`, the check of a portable document route, and
  `encodeUrlPath`, the URL encoding of a catalogue path.
- `RENDERS_PATH` and `RENDER_ID`, the route prefix and the id grammar of
  temporary renders.
- `GENERATED_DIRECTORY` and `VIEWER_DIRECTORY`, the directory names of the
  viewer namespace.
- The generated TypeScript types of the Rust model crate, such as
  `CatalogueReadModel` and `EntryDetailV4`.
- Nothing else. The routes, the other delivery paths, and the prop schema
  validators stay in `@mokly/viewer`. The package has no dependency and no
  peer, and it never imports the viewer, the CLI, or consumer code.

## What This Package Does

The package has one entry, its root, which exports each rule and each
generated type by name. It has no subpath. Its modules hold pure functions and
constants with no side effects, as `sideEffects: false` in `package.json`
states.

`cargo xtask generate-types` writes the generated modules from the shapes of
the Rust model crate. `src/generated/model.ts` holds the prop schema types and
the format version types. `src/generated/catalogue/` holds one module for each
catalogue type, and its `Namespace.ts` holds the directory names. Do not edit a
generated file. Change the Rust shape in `crates/mokly-model`, then generate
the modules again. `cargo xtask check-generated-types` fails when a generated
file is missing, changed, or extra.

`@mokly/viewer` imports the root entry of this package. The viewer's root
entry re-exports the public catalogue types. Its `./data` entry re-exports the
directory names, the current document paths, and the path and link grammar
that the [viewer contract](../../docs/protocol/mokly-viewer.md) lists, and it
holds no second implementation of them.

## Quick Start

```ts
import {
  currentDocumentPath,
  currentDocumentRoute,
  isEntryPath,
} from "@mokly/model";

isEntryPath("checkout/overview"); // true

const path = currentDocumentPath("checkout/overview/index.html");
// "static/mokly-generated/checkout/overview/index.html"

currentDocumentRoute(`/${path}`); // "checkout/overview/index.html"
currentDocumentRoute("/static/mokly-generated/../index.html"); // undefined
```

The [frame mapping rules](../../docs/protocol/mokly-artifact-paths.md#frames-and-reverse-mapping)
give the paths that `currentDocumentRoute` accepts.

## Development

From the repository root, `npm run build` builds this package after the UI
package and before the viewer. `npm run typecheck` includes it. Tests live
under `tests/` and run with `npm test -- packages/model/tests/<file>`. After a
change to a Rust shape, run `cargo xtask generate-types`, and commit the
generated modules with the Rust change.

File names are snake_case, as `AGENTS.md` says for every package except
`@mokly/ui`. The build sets `rootDir` to `src`, so it rejects a relative import
from outside the package. Import `GENERATED_DIRECTORY` or `VIEWER_DIRECTORY`
instead of spelling a directory name, such as `"mokly-generated"`. A lint
rejects the spelled name.

### Key Code

- [`src/index.ts`](./src/index.ts) — the root entry, which exports each rule
  and each generated type by name
- [`src/navigation/logical.ts`](./src/navigation/logical.ts) — the path
  grammar, such as `isEntryPath`, the link and fragment grammar, such as
  `parseLogicalTarget`, and the `isSafeRepositoryPath` check
- [`src/catalogue/delivery_paths.ts`](./src/catalogue/delivery_paths.ts) —
  `currentDocumentPath` with its inverse `currentDocumentRoute`, and
  `RENDERS_PATH` and `RENDER_ID` of temporary renders
- [`src/data/paths.ts`](./src/data/paths.ts) — `isSafeCatalogueRoute`, which
  checks that a document route is portable as a path and as a URL, and
  `encodeUrlPath`, which percent-encodes each path segment
- [`src/generated/model.ts`](./src/generated/model.ts) — the generated prop
  schema types and format version types
- [`src/generated/catalogue`](./src/generated/catalogue) — the generated
  catalogue types, one module each, and the directory names in `Namespace.ts`
- [`scripts/build.mjs`](./scripts/build.mjs) — removes `dist` and compiles the
  package with `tsconfig.build.json`
- [`tests`](./tests) — the Node tests of the grammar and the paths

### Related Docs

- [Model package contract](../../docs/protocol/mokly-model-package.md)
- [Paths, roots, and identity](../../docs/protocol/mokly-paths.md)
- [Authoring links](../../docs/protocol/mokly-authoring.md#links)
- [Path-derived artifact paths](../../docs/protocol/mokly-artifact-paths.md)
- [Viewer namespace and version gates](../../docs/protocol/mokly-viewer-namespace.md)
- [Component controls](../../docs/protocol/mokly-component-controls.md)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
- [Rust model crate](../../crates/mokly-model/README.md)
