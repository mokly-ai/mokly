# @mokly/frame

Status: In progress under the [frame package plan](../../plans/frame-package.md).

`@mokly/frame` holds Mokly's frame adapter interface, the built-in adapters,
and the frame probe that runs inside published pages. The Browse shell uses
these adapters to read and inspect catalogue previews. A host that embeds a
catalogue imports the public adapters and frame types from `@mokly/viewer`.

## Responsibilities

- The frame adapter interface and the built-in same-origin and postMessage
  adapters.
- Both ends of the frame probe wire protocol: the host transport and the
  probe inside a published page.
- The shared event runtime and the geometry rules that both adapters use.
- The frame session state that the viewer uses through the internal entry.

## What This Package Does

The root entry exports the public frame types, `sameOriginAdapter`, and
`postMessageAdapter`. The one internal entry, `@mokly/frame/internal`, holds
the frame operations that only `@mokly/viewer` uses. The package builds the
frame probe script, which the viewer copies into its browser outputs.

The package depends on the exact shared version of `@mokly/model`. It never
imports the viewer, the CLI, or consumer code. The viewer depends on this
package at the same exact version and re-exports its public interface. Hosts
use those viewer exports so that mounted frames share one installed copy's
session state.

## Quick Start

Build the package from the repository root:

```bash
npm run build --workspace @mokly/frame
```

Use the [viewer package](../viewer/README.md#quick-start) to embed a catalogue
and select a frame adapter.

## Development

`npm run build` builds this package after `@mokly/model` and before
`@mokly/viewer`. The package build compiles `src` into `dist`, then bundles
the frame probe into `dist/browser/frame-probe.js`. The viewer build copies
that script into `packages/viewer/dist/browser` and lists it in the viewer's
browser module inventory.

`npm run typecheck` includes its source and tests. The root
test runner discovers package tests under `tests/`. Run one with
`npm test -- packages/frame/tests/{file}`. `npm test --workspace @mokly/frame`
runs the package tests and accepts an empty test directory.

File names are snake_case, as `AGENTS.md` says for every package except
`@mokly/ui`. The build sets `rootDir` to `src`, so it rejects relative imports
from outside the package. Import directory names from `@mokly/model` instead
of spelling them in source.

### Key Code

- [`src/index.ts`](./src/index.ts) — the public package entry, which exports
  the frame adapter types
- [`src/internal.ts`](./src/internal.ts) — the entry for viewer-only frame
  operations, such as the shared event core, the wire schema, the inert map
  reader, the clipping rules, and the frame link rules
- [`src/frame_adapter.ts`](./src/frame_adapter.ts) — the public
  `FrameAdapter`, `FrameMount`, `MountedFrame`, and `FrameEvent` types, which
  `@mokly/viewer` re-exports
- [`src/probe`](./src/probe/README.md) — the frame probe IIFE and the shared
  event core that both adapters run
- [`src/navigation`](./src/navigation) — the link rules that only the frame
  code uses: `frameLinkActivation` in `activation.ts`, `parseLogicalMarker`
  and `logicalMarker` in `logical.ts`, and `parseBrowsingTarget` in
  `target.ts`
- [`../viewer/src/client`](../viewer/src/client/README.md) — the built-in
  adapters and their message transport, in the viewer package, which import
  the frame code through `@mokly/frame/internal`
- [`scripts/build.mjs`](./scripts/build.mjs) — removes `dist`, compiles the
  package with `tsconfig.build.json`, and bundles the frame probe
- [`scripts/probe-bundle.mjs`](./scripts/probe-bundle.mjs) — `bundleProbe`,
  which runs esbuild, the string pool of `probe-pool.mjs`, and Terser

### Related Docs

- [Frame package contract](../../docs/protocol/mokly-frame-package.md)
- [Frame adapter contract](../../docs/protocol/mokly-frame-adapter.md)
- [Frame probe contract](../../docs/protocol/mokly-frame-probe.md)
- [Frame probe wire protocol](../../docs/protocol/mokly-frame-probe-wire.md)
- [Model package](../model/README.md)
- [Package and consumer boundary](../../docs/architecture/package-boundary.md)
