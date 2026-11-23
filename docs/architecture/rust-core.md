# Rust Core Architecture

Status: The [Vite stylesheet transform](../../plans/storybook-support.md#milestone-16-stylesheets-through-vite) is not available yet. The sidecar release thread and finite file response bodies do not tell the render store that Serve is busy yet. The [remaining writer activity owners item](../../plans/follow-ups/render-store-idle-work-owners.md) adds them.

Mokly is a Rust core, a Node render sidecar, and a browser viewer. This page is
the map: the processes, the components and their responsibilities, the
boundaries between them, and the flow of data from the sources to a delivered
catalogue. The [package boundary](./package-boundary.md) page says what Mokly
owns and what a consumer owns. The protocol documents own the exact rules.

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
  CLI package version, and runs the binary with inherited standard streams.
  It never falls back to a JavaScript implementation.
- The binary owns the terminal, every command, and every file write. No
  command writes into the repository except `build`, which writes its output
  directory and the `.mokly-export-reservations/` directory beside it. The
  binary starts sidecars only when a catalogue needs JavaScript: a
  `.mockup.tsx` entry, a registered JavaScript component, a Storybook story, a
  configured renderer, a consumer PostCSS module, or a local stylesheet under the
  [Vite adapter](../protocol/mokly-vite-adapter-styles.md#catalogues-without-javascript).
- A sidecar renders what it is asked to render and returns text. It keeps no
  catalogue state beyond the loaded bundle generation. The
  [sidecar contract](../protocol/mokly-sidecar.md) owns the protocol.
- A sidecar compiles with esbuild by default. When the configuration turns on
  the [Vite adapter](../protocol/mokly-vite-adapter.md), it compiles with the
  project's Vite setup. That setup also transforms the stylesheets in place
  of consumer PostCSS.
- The Browse shell renders only in the browser, from the data that Serve or
  `build` delivers.

## Crates

| Crate                    | Responsibility                                                                                                        | Direct internal dependencies                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mokly-source-interface` | Read-only access to a working tree or a Git tree, with projected identities and typed read failures.                  | nothing internal                                                                                                                                            |
| `mokly-model`            | Every shared shape, the format versions, canonical JSON, the prop schema profile, and the generated TypeScript types. | nothing internal                                                                                                                                            |
| `mokly-platform`         | Operating-system services: exclusive rename, process trees, file locks, and durable writes.                           | nothing internal                                                                                                                                            |
| `mokly-git`              | Git commands: the merge base, changed paths, bounded tree reads, and archive extraction.                              | `platform`                                                                                                                                                  |
| `mokly-sidecar`          | The sidecar pool: process lifetime, framing, requests, deadlines, and recycling.                                      | `model`, `platform`                                                                                                                                         |
| `mokly-catalogue`        | Configuration, roots, discovery, front matter, paths, folders, variants, documents, and the catalogue model.          | `model`, `source-interface`                                                                                                                                 |
| `mokly-html`             | HTML components and screens: parsing, substitution, slots, composition, markers, links, and document assembly.        | `model`, `catalogue`, `source-interface`                                                                                                                    |
| `mokly-css`              | Stylesheet bundling, rule collection and diffing, selector matching, and attribution.                                 | `model`, `source-interface`                                                                                                                                 |
| `mokly-graph`            | The content-addressed render graph, the render cache, the render store boundary, and the referenced asset closure.    | `model`, `catalogue`, `source-interface`, `html`, `css`                                                                                                     |
| `mokly-render`           | JavaScript rendering through the sidecar: definitions, fragments, consumer PostCSS, and CSS Modules.                  | `catalogue`, `model`, `html`, `css`, `graph`, `sidecar`, `source-interface`, `compare`                                                                      |
| `mokly-compare`          | Changes: base-side rendering, dependency tiers, tree comparison, materiality, moves, and affected consumers.          | `source-interface`, `model`, `catalogue`, `html`, `css`, `graph`, `git`, `platform`, `sidecar`                                                              |
| `mokly-server`           | Serve over HTTP: the shell routes, documents and assets, live updates, on-demand comparison, and shutdown.            | `model`, `catalogue`, `graph`, `source-interface`, `compare`, `css`                                                                                         |
| `mokly-watch`            | Watch rules, invalidation, and rebuild requests.                                                                      | `catalogue`, `css`, `source-interface`                                                                                                                      |
| `mokly-static`           | The static output of `build` and its output transaction.                                                              | `model`, `compare`, `platform`, `catalogue`, `graph`, `html`, `source-interface`                                                                            |
| `mokly-publish`          | The upload exchange with a catalogue service.                                                                         | `git`, `model`                                                                                                                                              |
| `mokly-cli`              | The `mokly` binary: the command grammar, terminal output, and the composition of the other crates for each command.   | `compare`, `watch`, `render`, `sidecar`, `server`, `html`, `css`, `graph`, `catalogue`, `source-interface`, `model`, `publish`, `git`, `platform`, `static` |

`mokly-static` and `mokly-publish` share output shapes through `mokly-model`
and never depend on each other. The CLI composes the crates for each command
and turns a finished static output into one upload. To decrease allocator CPU
cost and peak memory, the CLI selects mimalloc as the global allocator for the
binary's Rust allocations. On every platform, the CLI shortens mimalloc's purge
delay after Serve's first ready Changes, to decrease the binary's resident
memory. The purge delay is the time after which a freed memory range becomes
due for its return to the operating system. Each crate's README names its entry
points.

## npm Packages

- `@mokly/mokly`: the shim, the sidecar entry, the JavaScript authoring API,
  the guides, and the protocol documents. It lists the five platform packages
  as exact optional dependencies.
- `@mokly/native-<target>`: one binary per platform: `linux-x64-gnu`,
  `linux-arm64-gnu`, `darwin-x64`, `darwin-arm64`, `win32-x64-msvc`.
- `@mokly/viewer`: the Browse shell. It renders in the browser from the
  catalogue index and the entry details, and its data readers follow the
  generated types.

## Data Flow

```text
mokly.config.json
        |
        v
discovery: HTML screens and components, entry modules, stories,
           Markdown documents, use cases, and folder records in each root
        |
        v
catalogue model: paths, folders, variants, props, the component registry
        |          (JavaScript definitions arrive through the sidecar)
        v
render graph: one node per output, keyed by the hash of its inputs
        |
        v
composed documents, one per view, kept in the render cache
        |
        +---- serve:   documents on request, live updates on change
        +---- build:   renders and captures every view once, then writes shell
                         routes into `--out`
        `---- Changes: base capture and comparison over the base commit's sources
```

1. The [configuration](../protocol/mokly-configuration.md) names the roots,
   the renderer module, the stylesheets, the module resolution settings, and
   the comparison base. Its filesystem paths are relative to the
   configuration file, and the configuration contract gives the base of each
   glob.
2. Discovery walks each root once. A file's suffix gives its kind, and its
   place in the root gives its [path](../protocol/mokly-paths.md). The core
   parses HTML, YAML, and Markdown. The sidecar bundles the JavaScript inputs
   into one generation and describes their definitions. HTML and JavaScript
   components join one registry keyed by element name. Validation reports
   every diagnostic before any render starts.
3. The core composes one document per view, that is per viewport and colour
   scheme. It renders HTML components itself. The sidecar renders JavaScript
   components, React screens, stories, and JavaScript pages, and returns each
   fragment with its collected styles. The core grafts the fragments, places
   the styles, rewrites `mock:` links, and assembles the document under the
   [document safety rules](../protocol/mokly-document-safety.md).
4. Serve reads composed documents from the render cache, then from the render
   store. `build` and `publish` render and retain a bounded head capture during
   the build check. Changes, static output, and comparison output read that
   capture. An uncaptured head document uses the head source, which renders it
   again only after the document leaves the render cache. The
   [comparison contract](../protocol/mokly-comparison.md) reads the ownership
   tree that composition keeps with each document.

## Render Graph

Every output is a node whose key is the hash of its inputs. A node is
recomputed only when its key changes, in parallel across a worker pool sized
to the machine. A watched change recomputes only the nodes whose keys moved.
An HTML-only edit never rebundles JavaScript. A JavaScript edit rebundles once
and renders again only the definitions whose render input key moved. A
component rendered with the same props on many screens renders once.

The render input key belongs to one entry module. It covers the modules that
the entry module imports, directly or through other modules, the renderer or
Storybook preview modules, their class maps, the paths and titles of the
definitions that they export or declare, their resolution files, and the
bundle settings and dependency installation. It contains no source root. The
[watch contract](../protocol/mokly-watch.md#invalidation-through-the-render-graph)
lists the inputs and the render inputs that are unsupported. Both sides of
Changes share the render cache, so an unchanged base view reuses the head's
render. Each side keeps its own sidecar generation for its cache misses.

No node is written to the repository. The render cache is process memory under
one byte bound, with a full tier and a compact tier. The full tier keeps
complete artifacts and evicts the least recently used first. A document that it
evicts stays in the compact tier in lossless form until that tier evicts it
too. The [runtime contract](../protocol/mokly-runtime.md#render-graph-and-cache)
owns the bound, the compact ceiling, and when a compact document returns to the
full tier. Serve reads head documents from the render cache. `build` and
`publish` capture the head during the build check under a separate 256 MiB
bound, then Changes and output read that capture. The base side of Changes has
its own 256 MiB capture bound. Serve keeps one captured base, with its graph,
sources, and leases, between classifications while the merge base and the base
inputs stay the same. An uncaptured head document uses the head source, which
renders it again only after the document leaves the render cache.
The base-side extraction cache, the dependency install cache, the bundle
cache of compiled JavaScript, and the render store live outside the repository,
in the operating system's cache directory under a key derived from the
repository path. Each has its own byte bound. The terminal names that
directory, and deleting it is safe. `publish` builds into its own directory
outside the repository and uploads.

Serve also keeps composed documents in the
[render store](../protocol/mokly-render-store.md), so a restart reuses them.
Serve gives its head and base graphs one store. A graph reads the store after
a render cache miss and offers each document that it renders. The graph sees
only the store boundary. The cache implementation owns the entries, the
receipts, the bound, and the pending writes, and no render waits for a write.
A pending write takes its document from the render cache, so the render cache
stays the one owner of document memory. Serve's requests, rebuilds, reference
probes, captures, render worker jobs, and sidecar pool work tell the store when
Serve is busy, and the publication tells it when the current Changes result is
complete. The writer starts new work only while Serve is idle. A store hit of a
head document also gives the sidecar pool its top-level JavaScript render
request, without a call. The pool replays such requests to warm its head
processes while Serve is idle. `build` and `publish` render without the store.

## Shell Delivery

The Browse shell is a browser application. Serve and `build` deliver one
identical stub page per shell route, the catalogue index, and one entry detail
per entry. Serve adds the live descriptor and the update event stream. The
shell renders itself from the index and the route's details. A current
component variant also reads its parent's detail. The shell fetches those
details on navigation and reloads only the frames whose document key changed.
No process renders shell HTML, so a catalogue that needs no JavaScript starts
no sidecar. The
[shell delivery contract](../protocol/mokly-shell-delivery.md) owns the
routes, the shapes, and the fences.

## Comparison Model

Comparison works on trees, never on text offsets. The
[comparison contract](../protocol/mokly-comparison.md) owns the rules:

- Both sides of a view are trees that the core composes in memory. Ownership
  and ignore regions are tree annotations. An element's owner is the
  innermost region that contains it.
- Materiality compares canonical trees after ignored regions and head styles
  are removed. Styles count through rule evidence only. Attribute order,
  entity spelling, and formatting differences are not changes.
- CSS attribution uses a rule-level diff, selector matching, and a
  conservative keep list.
- Both sides render from sources with the current Mokly version: the head
  from the working tree, the base from the base commit's Git tree. JavaScript
  inputs at the base run from extracted base sources under the dependency
  tiers of the comparison contract.

## Memory Bounds

- Comparison data lives in the core, outside the sidecar's JavaScript heap. A
  view's trees are discarded when its comparison ends. Each result holds at
  most one base capture, with its own byte budget, separate from the render
  cache. Serve keeps at most one base capture between classifications. A
  build result also holds one head capture with its own 256 MiB bound.
  Inputs above a side's budget read that side's sources: the pinned base
  sources for the base, and the head sources for the head.
- Parsed CSS, the render cache, the base-side extraction cache, the
  dependency cache, the bundle cache, and the render store are bounded by
  bytes. The render cache keeps the documents that its full tier evicts in a
  compact tier inside the same bound, and render store writes stay inside it
  too. A dependency install has a time limit.
- Sidecars are recycled after a fixed number of renders or when their
  resident size passes a fixed cap. The fragment cache makes a recycle cheap.
  The [sidecar memory contract](../protocol/mokly-sidecar-memory.md) owns
  the limits.
- The [diagnostics contract](../protocol/mokly-timings.md) records the time
  and memory budgets for the large fixture.

## Formats

Every persisted or exchanged format carries a version number, and readers
reject any other number before they interpret a field. The
[format inventory](../protocol/mokly-format-versions.md) lists the versions
and says when a number changes.
The render graph keeps generations in memory, so there is no private IPC
format.

## Related Docs

- [Package and consumer boundary](./package-boundary.md)
- [Sidecar contract](../protocol/mokly-sidecar.md)
- [HTML screens](../protocol/mokly-html-screens.md) and
  [HTML components](../protocol/mokly-html-components.md)
- [Comparison](../protocol/mokly-comparison.md)
- [Shell delivery](../protocol/mokly-shell-delivery.md)
- [Format inventory](../protocol/mokly-format-versions.md)
