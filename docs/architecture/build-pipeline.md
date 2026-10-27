# Render Pipeline

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page walks one render from the configuration file to a cached document.
The [Rust core architecture](./rust-core.md) is the map of the crates and the
render graph; the protocol pages own the exact rules.

## Overview

```text
mokly.config.json
        |
        v
walk `roots` -> HTML screens and components, entry modules, stories files,
                Markdown documents, use case files, `_folder.json` records
        |
        v
catalogue model: paths, folders, variants, props, the component registry
        |          (JavaScript definitions arrive through the sidecar's `describe`)
        v
render graph: one node per output, keyed by the hash of its inputs
        |
        +-- HTML component     -> substitution and slots, in Rust
        +-- React or Storybook -> a sidecar fragment, memoized by handle, props,
        |                         viewport, scheme, and enclosing ignore scope
        +-- stylesheet bundle  -> lightningcss, or the consumer's PostCSS module
        v
compose the document: viewports, colour schemes, ownership and ignore regions,
collected styles, `mock:` links, link validation
        |
        v
render cache (process memory, bounded by bytes)
        |
        +---- serve:   documents on request, live updates on change
        +---- build:   head capture, every document, and shell routes into `--out`
        `---- Changes: base capture and comparison over the base commit's tree
```

No step writes into the repository. `build` writes its output directory; the
base-side extraction cache and the dependency install cache live in the
operating system's cache directory.

## 1. Configuration

`mokly.config.json` is discovered from the working directory upward under the
[configuration contract](../protocol/mokly-configuration.md#configuration-discovery).
It names the `roots` that Mokly scans, the optional renderer module that wraps
React renders with the product's providers, the configured stylesheets, the
module resolution settings the sidecar bundles with, and the comparison base.
The [configuration contract](../protocol/mokly-configuration.md) owns the
fields; every path is relative to the configuration file.

## 2. Discovery And The Catalogue Model

Each root is walked once. A file's suffix gives its kind: `.screen.html`,
`.component.html`, `.page.html`, `.use-case.yaml`, `.md`, `.mockup.{ts,tsx}`,
or `.stories.{ts,tsx,js,jsx}`. Its place in the root gives its path under the
[path contract](../protocol/mokly-paths.md), and `_folder.json` records give
folders their titles and order.

HTML and YAML files are parsed in Rust: the front matter, the props, the
variants, and the body. JavaScript files are bundled by the
[sidecar](../protocol/mokly-sidecar.md) into one generation, and `describe`
returns every definition they export, one per export, each with its handle.
The HTML components and the JavaScript components join one registry keyed by
element name, with the `mokly-` prefix reserved. Props and variants follow the
[entry props contract](../protocol/mokly-entry-props.md): every screen and
component is a render over props, and a variant is a props set. Validation
reports every diagnostic with its file, line, and column before any render
starts.

## 3. The Render Graph

Every output is a node whose key is the hash of its inputs: the configuration,
an entry's source bytes, a bundle generation, a fragment, an HTML component, a
stylesheet bundle, or a composed document. A node is recomputed only when its
key changes, in parallel across a worker pool sized to the machine. A watched
change hashes the changed file and recomputes the nodes whose keys moved: an
HTML-only edit never rebundles JavaScript, and a JavaScript edit rebundles once
and re-renders only the fragments whose generation changed. A component
rendered with the same props on many screens renders once.

## 4. Composition

One document is composed per view, that is per viewport and colour scheme:

1. The body is parsed by the HTML fragment algorithm, and every hyphenated
   element is resolved against the registry.
2. An HTML component renders in Rust by substitution and slot filling,
   recursively. A JavaScript component renders through `renderComponent` with
   its coerced props, its slot placeholders, and the enclosing ignore scope;
   the fragment comes back with its collected styles, and the core grafts it
   in, reading its markers into ownership and ignore regions.
3. A whole React screen renders through `renderScreen`, a story through
   `renderStory`, and a JavaScript page through `renderPage`; `.page.html`
   files and Markdown documents are composed in Rust.
4. Collected styles are placed in the head as owned style elements, and the
   configured stylesheets are bundled on `lightningcss` or through the
   consumer's PostCSS module.
5. `mock:` links are rewritten to routes, links and markers are validated, and
   the document is assembled under the
   [document safety rules](../protocol/mokly-document-safety.md).

Serve keeps the finished document in the render cache with its ownership tree.
Build keeps the head capture for output and comparison. The
[comparison contract](../protocol/mokly-comparison.md) reads the relevant
side capture or cache.

## 5. Consumers Of The Cache

- `serve` renders the catalogue index at start and each document on request,
  watches the sources, and pushes live updates to the shell. Live prop edits
  render through the same path.
- `build` validates the catalogue, captures the head, renders every view, fails
  on errors and, with `--strict`, on warnings, and writes the static output: the shell stub
  per route, the index, one detail per entry, every document, the comparison
  generation, the viewer bundle, styles, and fonts, under the output
  transaction of the [static build contract](../protocol/mokly-export.md).
- Changes renders the base commit's sources through the same graph, with the
  base tree read from Git and JavaScript dependencies resolved under the
  dependency tiers, and compares the composed trees.

## Related Docs

- [Rust core architecture](./rust-core.md)
- [Package and consumer boundary](./package-boundary.md)
- [HTML screens, pages, and use cases](../protocol/mokly-html-screens.md)
- [Render sidecar](../protocol/mokly-sidecar.md)
- [Tree comparison and Changes](../protocol/mokly-comparison.md)
