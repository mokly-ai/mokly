# Rust Core Architecture

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Mokly's backend is a Rust core and a Node sidecar. This document is the map: the
processes, the crates, the render graph, the comparison model, the memory
bounds, and the format inventory. The protocol documents own the exact rules.

## Process Topology

```text
npx mokly ...                  @mokly/mokly shim: Node version gate, binary lookup
  └─ mokly (Rust binary)       @mokly/native-<target>: CLI, render graph, HTML
       │                       rendering, CSS, comparison, watch, server,
       │                       static build, publish
       └─ sidecar pool (Node)  @mokly/mokly: bundling, definitions, React, page,
                               and Storybook renders, consumer PostCSS
```

- The shim resolves the platform package, checks that its version equals the
  CLI package version, and executes the binary with inherited standard streams.
  It never falls back to a JavaScript implementation.
- The binary owns the terminal, every command, and every file write; no
  command writes into the repository except `build` into its output
  directory. It starts sidecars only when a catalogue needs JavaScript: a
  `.mockup.tsx` entry, a registered JavaScript component, a Storybook story,
  or a consumer PostCSS module. The Browse shell renders only in the browser.
- A sidecar renders what it is asked to render and returns text. It keeps no
  catalogue state beyond the loaded bundle generation. The
  [sidecar contract](../protocol/mokly-sidecar.md) owns the protocol.

## Crates

| Crate             | Owns                                                                                                                                                              | Depends on                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `mokly-model`     | Every shared shape, canonical JSON, format numbers, the prop schema profile and its validator on the `jsonschema` crate, and the generated TypeScript types.      | nothing internal                             |
| `mokly-platform`  | Exclusive rename, process groups, Windows job objects, file locks.                                                                                                | nothing internal                             |
| `mokly-git`       | The Git command runner, merge base, changed paths, bounded blob and tree reads, archive extraction.                                                               | `platform`                                   |
| `mokly-sidecar`   | The sidecar pool: spawning, framing, requests, timeouts, recycling.                                                                                               | `model`, `platform`                          |
| `mokly-catalogue` | Roots, discovery, front matter, path identity, folders, variants, use cases, documents, the catalogue model.                                                      | `model`, `sidecar`                           |
| `mokly-html`      | HTML components and screens: parsing, substitution, slots, composition, markers, link rewriting, document assembly, the component registry.                       | `model`, `catalogue`, `sidecar`              |
| `mokly-css`       | Stylesheet bundling on `lightningcss`, rule collection, diffing, selector matching, the keep list, attribution.                                                   | `model`                                      |
| `mokly-graph`     | The content-addressed render graph, scheduling, the render cache, the source tree trait over the working tree and Git trees, the asset closure.                   | `catalogue`, `html`, `css`                   |
| `mokly-compare`   | Base-side rendering, the dependency tiers, tree comparison, materiality, moves, affected consumers, review result v8, change snapshot v4.                         | `graph`, `css`, `git`, `platform`, `sidecar` |
| `mokly-server`    | HTTP, the shell stub, the catalogue index and entry detail routes, documents and assets, the live descriptor, live updates, on-demand comparison, shutdown.       | `graph`, `compare`, `sidecar`                |
| `mokly-watch`     | Watch rules, invalidation, rebuilds, replay.                                                                                                                      | `graph`, `server`                            |
| `mokly-static`    | The static output of `build`: the stubs, the catalogue index, the entry details, documents, the comparison generation, ownership markers, the output transaction. | `graph`, `compare`, `platform`               |
| `mokly-publish`   | The upload exchange v1: plan, blobs, complete, retries, accounting.                                                                                               | `static`                                     |
| `mokly-cli`       | The `mokly` binary: clap grammar, output modes, reporters, shortcuts, the composition root.                                                                       | everything above                             |

Dependencies point downward only. Every impure boundary is a trait consumed
through `dyn`, mocked with `unimock` in unit tests. Each crate has a README with
the required sections, 300-line files, and `_tests_` directories.

## npm Packages

- `@mokly/mokly`: the shim, the sidecar entry, the JavaScript authoring API
  (`defineScreen`, `defineComponent`, `definePage`, `defineUseCase`,
  `defineFolder`, `MockLink`, `ReviewIgnore`), the guides, and the protocol
  documents. It lists the five platform packages as exact optional
  dependencies.
- `@mokly/native-<target>`: one binary per platform: `linux-x64-gnu`,
  `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`, `win32-x64-msvc`.
- `@mokly/viewer`: renders the Browse shell in the
  browser from the catalogue index and entry detail routes, and its data
  readers follow the generated types.

## Render Graph

Every output is a node whose key is the hash of its inputs. Nodes are
recomputed only when a key changes, in parallel across a worker pool sized to
the machine.

| Node              | Key                                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| config            | the resolved config and the Mokly version                                                                                                                                                                        |
| entry source      | the file bytes of a screen, component, page, use case, document, or folder record                                                                                                                                |
| bundle generation | the sidecar's module graph: every consumer source file, the renderer module, resolution settings, the installed React version                                                                                    |
| fragment          | bundle generation, render kind, definition handle or story id, canonical props, viewport, colour scheme, enclosing ignore scope; a page render is a fragment of kind `page`, keyed by generation and handle only |
| HTML component    | its source and the keys of the components it uses                                                                                                                                                                |
| stylesheet bundle | the root's imported CSS sources, assets, PostCSS module, and resolution settings                                                                                                                                 |
| document          | the entry key, viewport, colour scheme, the fragment and component keys it composes, the stylesheet rules that apply, the config key; a page document has no viewport or scheme                                  |
| source tree       | the working tree, or the base commit's Git tree read through blobs and extracted on demand                                                                                                                       |
| dependency set    | the side's lockfile and package manifests and the package manager version                                                                                                                                        |
| definitions       | the bundle generation, through the sidecar's `describe` call: every exported definition and the story inventory                                                                                                  |
| catalogue model   | every entry record and the definitions                                                                                                                                                                           |
| catalogue index   | the catalogue model without per-view usage and resource evidence, the document keys of every view, page, and document, and, in Serve, the render generation                                                      |
| entry detail      | the entry's views' usage and resource evidence from the composed trees, and its workspace lists from the catalogue model                                                                                         |

A watched change hashes the changed file, finds the nodes whose keys moved, and
recomputes only those. An HTML-only edit never rebundles JavaScript; a
JavaScript edit rebundles once and re-renders only the fragments whose
generation changed. Fragment results are memoized across screens, so a
component rendered with the same props on many screens renders once.

No node is written to the repository. The render cache is process memory,
bounded by bytes and evicted least recently used; Serve, Changes, and `build`
read it. The base-side extraction cache and the dependency install cache live
outside the repository, in the operating system's cache directory under a key
derived from the repository path, each with its own byte bound and
least-recently-used eviction; the terminal names that directory, and deleting
it is safe. `build` is the only command that writes into the repository, into
the output directory `--out` names, `mokly-static/` at the repository root by
default, which Git must ignore; `publish` builds into its own directory outside
the repository and uploads.

## Shell Delivery

The Browse shell is a browser application. Serve and `build` deliver one
identical stub page per shell route, the catalogue index at
`mokly-viewer/index.json`, and one entry detail per entry under
`mokly-viewer/entries/`; Serve adds the live descriptor and the update event
stream. The shell renders itself from the index and the current entry's
detail and fetches the next detail on navigation. The index carries one
revision per Serve state and the document key of every view, page, and
document, and the shell reloads only the frames whose key changed. No
process renders shell HTML, so a catalogue without JavaScript starts no
sidecar. The
[shell delivery contract](../protocol/mokly-shell-delivery.md) owns the
routes, the shapes, and the fences.

## Comparison Model

Comparison works on trees, never on text offsets. The
[comparison contract](../protocol/mokly-comparison.md) owns the rules:

- Both sides of a view are trees the core composed in memory. Ownership and
  ignore regions are node annotations; a sidecar fragment carries them as
  comment markers, which the core reads and drops when it grafts the fragment.
  An element's owner is the innermost region that contains it.
- Materiality compares canonical trees after ignored regions and head style
  elements, owned and unowned, are removed; styles count through rule
  evidence only. Attribute order, entity spelling, and formatting
  differences are not changes.
- CSS attribution uses a rule-level diff, selector matching, and
  conservative keep list, on the `lightningcss` and `selectors` crates.
- A sidecar-rendered component returns the styles its render produced, so
  their owner is known by construction. Head styles of a whole-screen render
  are attributed by the same selector matching, with the entry as the default
  owner.
- Both sides render from sources with the current Mokly version: the head from
  the working tree, the base from the base commit's Git tree. A React or
  Storybook component, a React screen, the renderer module, or consumer PostCSS
  at the base runs from the base commit's extracted sources under the three
  dependency tiers of the comparison contract.

## Memory Bounds

- Comparison data lives in Rust memory, outside the sidecar's V8 heap. A view's
  trees are discarded when its comparison ends; nothing retains a catalogue-wide
  set of parsed pages.
- Parsed CSS is cached by content hash with a byte bound; eviction changes time
  only.
- The render cache, the base-side extraction cache, and the base-side
  dependency cache are bounded by bytes; a dependency install has a time limit.
- Sidecars are recycled after a fixed number of renders or when their
  resident size passes a fixed cap; the fragment cache makes a recycle cheap.
- The [diagnostics contract](../protocol/mokly-timings.md) records the time and
  memory budgets for the large fixture, with the sidecar count held constant.

## Format Inventory

A number changes only when its
shape or interpretation changes. No reader accepts an earlier number; readers
reject before interpreting any field. Package 1.0.0 is the first number held
stable.

| Boundary                               | Version | Content                                                   |
| -------------------------------------- | ------- | --------------------------------------------------------- |
| Public catalogue read model            | 7       | the catalogue index at `mokly-viewer/index.json`          |
| Entry detail                           | 1       | one entry's usage, resource evidence, and workspace lists |
| Review result                          | 8       | tree materiality and owner-attributed rules               |
| Catalogue change snapshot              | 4       | pairs review v8 with the base commit                      |
| Live descriptor                        | 3       | the Serve JSON route with the render capability           |
| Inspector wire envelope                | 2       | the frame adapter messages                                |
| Removed page/document preview metadata | 3       | the preview of a removed page or document                 |
| Export ownership                       | 3       | the ownership marker `build` writes                       |
| Upload metadata, plan exchange         | 2, 1    | the publish exchange Mokly Cloud implements               |
| Export transaction marker              | 2       | the output transaction marker `build` writes              |
| Navigation disclosure storage          | v4      | the shell's navigation disclosure state                   |
| Timing and verification records        | 1       | the timing and verification evidence records              |

The render graph keeps generations in memory; there is no private IPC format.

## Related Docs

- [Sidecar contract](../protocol/mokly-sidecar.md)
- [HTML screens](../protocol/mokly-html-screens.md) and
  [HTML components](../protocol/mokly-html-components.md)
- [Comparison](../protocol/mokly-comparison.md)
- [Shell delivery](../protocol/mokly-shell-delivery.md)
- [Format inventory](../protocol/mokly-format-versions.md)
- [Render pipeline](./build-pipeline.md)
