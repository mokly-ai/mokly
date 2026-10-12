# Rust Core Architecture

The [Rust rebuild plan](../../plans/rust-rebuild.md) replaces the TypeScript
backend with a Rust core and a Node sidecar. This document is the map: the
processes, the crates, the build graph, the comparison model, the memory
bounds, and the format inventory. The protocol documents own the exact rules.

## Process Topology

```text
npx mokly ...                  @mokly/mokly shim: Node version gate, binary lookup
  └─ mokly (Rust binary)       @mokly/native-<target>: CLI, build graph, HTML
       │                       rendering, CSS, comparison, watch, server,
       │                       export, publish
       └─ sidecar pool (Node)  @mokly/mokly: bundling, React, Storybook and
                               viewer-shell renders, consumer PostCSS
```

- The shim resolves the platform package, checks that its version equals the
  CLI package version, and executes the binary with inherited standard streams.
  It never falls back to a JavaScript implementation.
- The binary owns the terminal, every command, and every file the catalogue
  writes. It starts sidecars only when a catalogue needs JavaScript: a
  `.mockup.tsx` entry, a registered JavaScript component, a Storybook story,
  a consumer PostCSS module, or the viewer shell for Serve and export.
- A sidecar renders what it is asked to render and returns text. It keeps no
  catalogue state beyond the loaded bundle generation. The
  [sidecar contract](../protocol/mokly-sidecar.md) owns the protocol.

## Crates

| Crate             | Owns                                                                                                                    | Depends on                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `mokly-model`     | Every shared shape, canonical JSON, format numbers, and the generated TypeScript types.                                 | nothing internal                |
| `mokly-platform`  | Exclusive rename, process groups, Windows job objects, file locks.                                                      | nothing internal                |
| `mokly-git`       | The Git command runner, merge base, changed paths, bounded blob and tree reads, archive extraction.                     | `platform`                      |
| `mokly-sidecar`   | The sidecar pool: spawning, framing, requests, timeouts, recycling.                                                     | `model`, `platform`             |
| `mokly-catalogue` | Roots, discovery, front matter, path identity, folders, variants, use cases, documents, the registry, manifest v11.     | `model`                         |
| `mokly-html`      | HTML components and screens: parsing, substitution, slots, composition, markers, link rewriting, document assembly.     | `model`, `catalogue`, `sidecar` |
| `mokly-css`       | Stylesheet bundling on `lightningcss`, rule collection, diffing, selector matching, the keep list, attribution.         | `model`                         |
| `mokly-build`     | The content-addressed build graph, scheduling, the output transaction, tracked and untracked rules, the public closure. | `catalogue`, `html`, `css`      |
| `mokly-compare`   | Baselines, tree comparison, materiality, moves, affected consumers, review result v8, change snapshot v4, artifacts.    | `build`, `css`, `git`           |
| `mokly-server`    | HTTP, static delivery, read model v7, shell routes, live updates, on-demand comparison, shutdown.                       | `build`, `compare`, `sidecar`   |
| `mokly-watch`     | Watch rules, invalidation, rebuilds, replay.                                                                            | `build`, `server`               |
| `mokly-export`    | The static site, delivery descriptors, ownership markers, the export transaction.                                       | `build`, `compare`, `platform`  |
| `mokly-publish`   | The unchanged upload exchange v1: plan, blobs, complete, retries, accounting.                                           | `export`                        |
| `mokly-cli`       | The `mokly` binary: clap grammar, output modes, reporters, shortcuts, the composition root.                             | everything above                |

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
- `@mokly/viewer`: unchanged in purpose; its data readers follow the generated
  types.

## Build Graph

Every output is a node whose key is the hash of its inputs. Nodes are
recomputed only when a key changes, in parallel across a worker pool sized to
the machine.

| Node              | Key                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| config            | the resolved config and the Mokly version                                                                                            |
| entry source      | the file bytes of a screen, component, page, use case, document, or folder record                                                    |
| bundle generation | the sidecar's module graph: every consumer source file, the renderer module, resolution settings, the installed React version        |
| fragment          | bundle generation, render kind, export or story id, canonical props, viewport, colour scheme                                         |
| HTML component    | its source and the keys of the components it uses                                                                                    |
| stylesheet bundle | the root's imported CSS sources, assets, PostCSS module, and resolution settings                                                     |
| document          | the entry key, viewport, colour scheme, the fragment and component keys it composes, the stylesheet rules that apply, the config key |
| manifest          | every entry record and document key                                                                                                  |

A watched change hashes the changed file, finds the nodes whose keys moved, and
recomputes only those. An HTML-only edit never rebundles JavaScript; a
JavaScript edit rebundles once and re-renders only the fragments whose
generation changed. Fragment results are memoized across screens, so a
component rendered with the same props on many screens renders once.

## Comparison Model

Comparison works on trees, never on text offsets. The
[comparison contract](../protocol/mokly-comparison.md) owns the rules:

- Both sides of a view are parsed with a spec-compliant HTML parser into trees.
  Mokly's component and ignore markers are comment nodes in those trees, so an
  element's owner is the innermost marker region that contains it.
- Materiality compares canonical trees after ignored regions and head style
  elements, owned and unowned, are removed; styles count through rule
  evidence only. Attribute order, entity spelling, and formatting
  differences are not changes.
- CSS attribution keeps today's rule-level diff, selector matching, and
  conservative keep list, on the `lightningcss` and `selectors` crates.
- A sidecar-rendered component returns the styles its render produced, so
  their owner is known by construction. Head styles of a whole-screen render
  are attributed by the same selector matching, with the entry as the default
  owner.
- Baselines are the base commit's tracked `mokly-generated/` blobs, or a
  rebuild by the base's own commands when the output is untracked.

## Memory Bounds

- Comparison data lives in Rust memory, outside the sidecar's V8 heap. A view's
  trees are discarded when its comparison ends; nothing retains a catalogue-wide
  set of parsed pages.
- Parsed CSS is cached by content hash with a byte bound; eviction changes time
  only.
- Sidecars are recycled after a fixed number of renders or when their
  resident size passes a fixed cap; the fragment cache makes a recycle cheap.
- The acceptance milestone of the plan records the time and memory budgets for
  the large fixture, with the sidecar count held constant.

## Format Inventory

Numbers keep counting from the frozen backend. A number changes only when its
shape or interpretation changes. No reader accepts an earlier number; readers
reject before interpreting any field. Package 1.0.0 is the first number held
stable.

| Boundary                               | Version        | Change from the frozen backend                                    |
| -------------------------------------- | -------------- | ----------------------------------------------------------------- |
| Private generated manifest             | 11             | HTML entry kinds, marker-derived ranges, no recorded text offsets |
| Public catalogue read model            | 7              | follows manifest v11 and review v8 evidence                       |
| Review result                          | 8              | tree materiality, owner-attributed rules, no offsets              |
| Catalogue change snapshot              | 4              | pairs review v8 with manifest v11 baselines                       |
| Live catalogue index                   | `live-index-3` | manifest v11 entry shapes                                         |
| Shell bootstrap envelope               | 3              | embeds catalogue v7                                               |
| Baseline completion marker             | 3              | requires manifest 11 and the `generated-v11` layout               |
| Static delivery descriptor             | 5              | unchanged                                                         |
| Private live capability descriptor     | 2              | unchanged                                                         |
| Inspector wire envelope                | 2              | unchanged                                                         |
| Removed page/document preview metadata | 3              | unchanged                                                         |
| Export ownership                       | 3              | unchanged                                                         |
| Upload metadata, plan exchange         | 2, 1           | unchanged; Mokly Cloud implements them                            |
| Export transaction marker              | 2              | unchanged                                                         |
| Navigation disclosure storage          | v4             | unchanged                                                         |
| Timing and verification records        | 1              | unchanged                                                         |

The accepted output snapshot format of the frozen backend has no successor;
the build graph keeps generations in memory without a private IPC format.

## Related Docs

- [Rust rebuild plan](../../plans/rust-rebuild.md)
- [Sidecar contract](../protocol/mokly-sidecar.md)
- [HTML screens](../protocol/mokly-html-screens.md) and
  [HTML components](../protocol/mokly-html-components.md)
- [Comparison](../protocol/mokly-comparison.md)
- [Format inventory](../protocol/mokly-format-versions.md)
- [Build pipeline of the frozen backend](./build-pipeline.md)
