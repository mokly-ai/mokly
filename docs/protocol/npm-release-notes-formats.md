# npm Format And Tooling Release Notes

Continuation of [npm Release Notes](./npm-release-notes.md).

## Boundary And Tooling Changes

`parseStaticDelivery` returns `valid`, `unsupported-version` or `invalid`
results and never throws. Callers read the descriptor from a valid result's
`value`. Browser boundary readers throw `MoklyVersionError`; export keeps
`export-invalid`. `ViewerError.code` includes `version`, with optional
diagnostic `details` beside the existing product-facing `message`.

`MoklyVersionError.boundary` now also accepts `"review"`. The review reader
throws that error for numeric versions other than 7 before reading content.
Comparison requests preserve its code, boundary, received version and supported
version. Malformed current results keep a plain invalid-review error with one
`[mokly/review]` prefix. Comparison failures use the existing compatible-viewer
message, with version numbers only in diagnostic details. Embedded viewers emit
`onError` with code `"version"`; Current remains available without comparison panes.

The watch-writer change that was to move successful plain baseline notes and
the earlier-version notice to stdout is frozen with the TypeScript backend and
never landed; errors and requested timing JSON retain stderr. Referenced authored files are not private solely because of an extension
or build-folder name; source inputs, protected locations, hidden segments and
symlinks remain private.

## Combined Path And Output Formats

The path/output integration uses manifest v10, catalogue v6, review v7, delivery
v5 and bootstrap v2. Live capability descriptors and the inspector wire use v2;
the live index is `live-index-2`, catalogue change snapshots use v3 and baseline
completion markers use v2 with `generated-v10`. Export ownership v3, upload v2
and Plan v1 retain their shapes. See the
[complete format inventory](./mokly-format-versions.md).

File-derived paths replace `id`/`navPath`, and `roots` replaces `entries` and
`entriesDir`. Markdown documents, folders and moves use the incoming path
contract. Every generated file now lives under `mokly-generated/`, including
Markdown resource copies. Manifest v9 and below are earlier baseline output;
catalogue v5 and review v6 and below are unsupported public payloads. Rebuild
with the matching package; no converter is provided. The preview command against
an earlier main base still succeeds with Changes unavailable. Only the explicit
writers take the output lock; immutable in-memory route snapshots replace disk
capture and reject undeclared worker routes.

## First Rust Core Release

The first Rust core release is a breaking 0.x minor release. Install `@mokly/mokly`; npm
selects its matching viewer and native dependencies. Rebuild all
published catalogues. No compatibility reader or converter exists for older
configuration, authoring modules, generated output, or caches.

### Commands And Configuration

- Use `serve` to browse with watch enabled by default. Use `build` to validate,
  render every view, and write a static site. `publish` builds a private site
  and uploads it. `check`, `export`, and `review` are absent. For validation,
  run `mokly build --strict --out {temporary-directory}`. Replace
  `export --out` with `build --out`. `build --watch` and `serve --build` are
  absent; use watched Serve for development.
- Configuration is data-only `mokly.config.json`. `--config` names another JSON
  file. TypeScript and JavaScript configuration and `defineConfig` are absent.
  Use the shipped `config.schema.json` for editor checks. Filesystem paths are
  relative to the configuration file. `$componentStylesheets` is the only
  stylesheet token. Replace the `componentStylesheets` JavaScript export
  with this token in the JSON stylesheet list. `WatchConfig` and `ReviewConfig`
  are removed configuration types.
  Replace extglob stylesheet matches such as `@(a|b)` with brace alternatives
  such as `{a,b}`. Unsupported extglob matchers emit a `stylesheet-extglob`
  configuration warning that names the pattern and suggests brace alternatives.
  `--strict` fails on this warning under the normal build-warning policy.
  Replace flat generated-filename matches with entry routes such as
  `product/**/index.html`. Local stylesheet paths resolve from the JSON file.
  Remove `.css: "text"` loader overrides. Import CSS normally so the core
  delivers its stylesheet and referenced assets.
- Do not commit generated output. `build` defaults to `mokly-static/`, which
  must be ignored by Git. Remove committed `mokly-generated/` output and
  `.mokly-cache`. Serve and comparisons render in memory. Base extraction and
  dependency caches use the operating system's cache directory.
- `serve`, `build`, and `publish` accept `--base`. `build` and `publish` accept
  `--no-changes`. Publish has no `--out`; it names its private build directory
  before building and keeps it after a failed upload. Publish requires a clean,
  committed checkout. Static output requires an empty directory or its valid
  ownership marker.

### Platforms And JavaScript

The npm shim selects one version-matched Rust binary. Supported targets are
Linux x64 and ARM64 with glibc 2.28 or newer, macOS 11.0 or newer on x64 and
ARM64, and Windows x64 with MSVC. The binary uses the supported Node runtime's OS floor. Windows
links its C runtime statically and needs no separate Visual C++ runtime.
There is no JavaScript CLI fallback. Keep optional dependencies enabled during
installation. Mokly supports Node `>=22.15.0 <23.0.0 || >=24.0.0 <24.14.0 || >=24.19.0`; the shim rejects
unsupported versions before binary lookup.

HTML-only catalogues need no JavaScript sidecar. React and Storybook authoring,
page callbacks, and consumer PostCSS start sidecars as needed. React and React
DOM come from the consumer. The sidecar bundles JavaScript; the Rust core owns
CSS Modules, document assembly, caching, and invalidation.

### Authoring And Comparison

HTML screens and components use leading YAML front matter. Their bodies share
`{{name}}`, `$name`, `mokly-if`, and `mokly-viewport`. Components can declare
slots. Complete HTML pages and YAML use cases need no JavaScript.

Every screen and component has its own props and optional variants. A variant
replaces top-level prop keys. `defineScreen` and `defineComponent` use
`render(props, context)`, with `context` containing `viewport` and `colorScheme`.
Each export contributes one definition; array exports fail. A Storybook file
contributes one component, with its stories as variants and their args as props.
`argTypes` supplies control hints and does not define validation. `definePage`
returns one complete synchronous document.

Replace uses of a registration's `.entries` with its definition. Update code
that indexes exported arrays or reads `id`, `navPath`, or `variantOf` from
renderer input. Keep instance names separate from entry paths: `moklyInstance`
uses lowercase kebab-case and cannot contain path separators.

Renderer modules return a React node or `{ node, resources }`. Their input
has `props` and an entry address with `kind`, `path`, and `title`. The core
assembles the document and stylesheet links. Put theme attributes and `lang`
on the renderer's wrapper element.
Update CSS selectors that depend on consumer attributes on `html` or `body`.
Pass caller-specific values, such as a palette, through declared component
props. Each component render establishes its own providers; arbitrary caller
React context does not cross that boundary.

Prop schemas use the strict JSON Schema 2020-12 profile. Object schemas must
be closed with `additionalProperties: false`. Defaults, references, and
unsupported keywords fail. The schema can be inferred where the entry contract
permits it. Non-data values are excluded with a warning. See
[entry props](./mokly-entry-props.md).
Supply valid parent props as well as variant props. Move saved React slot
content into each variant's `slots` field. At registered instance boundaries,
omit absent optional data keys instead of passing `undefined`, including
inside nested objects. Keep generic input helpers aligned with the public
schema-inference types and check them against the installed declarations.
Keep catalogue fixture data in the consumer source tree instead of importing
internal fixture files from the installed CLI package.

Comparisons render both sides from sources with the installed Mokly version.
A base whose sources fail current validation makes Changes unavailable with
those diagnostics. Base JavaScript reuses identical-lockfile dependencies,
installs a differing lockfile into the bounded cache with lifecycle scripts
disabled, or warns and uses working-tree dependencies if installation fails.
There is no committed baseline output. Entry paths derive from files; use
`movedFrom` to identify an entry moved with content changes.

Tree comparison removes ignored regions and head styles before materiality
checks. Changed CSS contributes rule evidence through selector matching.
Source dependency declarations do not determine Changes. Instance and slot
markers remain in delivered documents for inspection. Ignore and logical-link
markers are consumed during composition.

Component parents render their own views from their props. Static Changes
captures both sides of pages and Markdown documents and their resources.
Configured CSS uses `styles/{repository-relative stylesheet path}` under
`static/mokly-generated/`; referenced authored files use their repository
paths under `static/`. Base snapshots include the same generated delivery
roots as current output.
Rewrite authored relative URLs so they resolve from the document route to
`static/{repository path}`.

Schema, control, and declared-slot metadata changes list the component parent.
Variants keep independent metadata, props, and supplied-slot changes. A shared
schema edit alone does not add one Changes row per variant.

Caller-owned component props remain material when the rendered HTML is equal.
Review records keep every applicable reason, including both `inputs` and
`material`. The view's `ignoredIds` lists every paired region used for
equality, including equal regions in unchanged views.
React-generated accessibility IDs can change after structural edits. Those
attribute changes can supply actual-instance implementation evidence even
when the component's saved views stay unchanged.

CSS evidence names delivered resource routes. Unowned head-style edits use
per-rule records at the containing public document route. A removed view keeps
matched and conservative rule records from its available before-side tree.
Missing entries use their `added` or `removed` reason; `material` describes a
paired view's canonical-form change.

A use case has no views, so its review aggregate stays `unchanged` while
its screen reasons independently include it in Changes.

Affected-consumer chains start inside that consumer. They omit its own
instance and outer ancestors; each context keeps its side and variant address.

### Viewer And Wire Formats

The Browse shell renders in the browser. Serve and static builds deliver the
same shell stub, catalogue index v7, and entry detail v1. Review results use v8,
change snapshots use v4, and the live descriptor uses v3. Readers accept one
version only. The [format inventory](./mokly-format-versions.md) owns all numbers.

Use the viewer's root, `./browser`, `./data`, and `./styles.css` entries. The
`./server` and `./runtime` entries, `renderViewer`, shell hydration, and embedded
bootstrap data are absent. `./data` exports only the path functions, the
directory names, the path and link grammar, and the prop schema validators. `MoklyViewer` takes index and detail sources.
`readCatalogueIndex` and `readEntryDetail` read those boundaries.
`resolveInstance` and `InstanceResolution` are available only from
`@mokly/viewer`; remove imports of them from `@mokly/mokly`. The index has
one revision and a document key per document; updates refresh affected frames
without reloading the page. Serve sends no cross-origin response headers.

Mokly Cloud must reset and republish its catalogue with the matching viewer and
receiver. The Plan, Blob, Complete upload exchange remains v1; its validation
rules and content-delta behavior do not change.

### Deep Trees And Scale Tools

HTML trees use explicit work stacks for composition, repair, serialization,
cloning, equality, and destruction. They need no enlarged thread stack.
`plaintext` has no synthetic closing tag. Its parsed tree is the stable
browser repair of the serialized payload, including formatting clones and
foster-parented content. Initial newlines in `pre`, `textarea`, and `listing`
survive repeated parsing.

The opt-in large fixture has native HTML and React variants. Component parent
views and Markdown documents give 5,850 documents across 1,620 routes. Generated
output is ignored. One Markdown document per area exercises Markdown rendering
in both colour schemes. The harness uses the Rust CLI and records build, Serve,
Changes, and watch measurements. Workspace reuse and isolated installs are
distinct modes. The opt-in benchmark enforces the
[approved release startup budgets](./mokly-timings.md#budgets).
Automated correctness tests have no wall-clock assertions.
