# Imported Stylesheet CSS Modules

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [Imported Stylesheet Delivery](./mokly-imported-styles.md).
The [error catalogue](./mokly-imported-styles-errors.md) gives exact messages.

## CSS Modules And Import Loaders

A `*.module.css` import is a CSS Module. Mokly applies the rename-only
scoping that css-loader and Vite apply by default, in the sidecar: `bundle`
scopes the file to produce the class map that the JavaScript import receives,
and `processCss` returns the scoped text that the core bundles under the
[delivery contract](./mokly-imported-styles.md#bundling). Both use one naming
rule, so the map and the delivered stylesheet agree by construction; a
generation whose map and text disagree fails before anything is served.
Scoping runs after renderer pruning and after the consumer's PostCSS plugins,
with `map: false`, so a `sourceMappingURL` comment never loads a map or reads
a file. Diagnostic positions refer to the CSS that the scoper receives.

### Names

The generated name is `mokly_<hash>_<local>`, where `<hash>` is the first
twelve lowercase hex digits of SHA-256 over the UTF-8 repository-relative
POSIX stylesheet path. It never depends on source bytes, bundle order, the
working directory, or platform separators, so both comparison sides and every
platform agree. Two distinct local identities that collide at one generated
name fail the build.

Only local class selectors, id selectors, `@keyframes` names, and their
`animation` and `animation-name` references are renamed. `:global(...)`
keeps its content global and `:local(...)` makes it local, including the
bare forms. `@counter-style` names and list-style references,
`view-transition-name`, custom properties and `var(--token)`, grid-area
names, and container names stay global. An `@scope` prelude is localized
like a selector, and its local names are exported and count for collisions.
A `:global()` or `:local()` wrapper with no selector fails, wherever it
occurs. CSS whitespace means space, tab, line feed, carriage return, and form
feed; another Unicode space is a name character, and an escape consumes the
one whitespace character that ends it.

The scoper does not optimize, prefix, polyfill, or normalize declarations,
selectors, comments, `@import`s, `url()`s, `image-set()` options, fallbacks,
media, supports, or layer conditions, or modern syntax; everything reaches
the bundler as authored. A scoping result that would change anything other
than a local name, for example a selector reprinted as a different selector
or a keyframe reference rewritten into an invalid declaration, fails with
the catalogued diagnostic instead of shipping. The `image-set()` string
guard runs before scoping. `lightningcss` bundles the scoped text and is
never a CSS Modules transform; browserslist targets are the consumer's
PostCSS concern.

### Composition And Exports

Authored `:import(...)`, `:export`, and `@value` fail before scoping with
the catalogued diagnostics. `composes` names only a local class defined
earlier in the same file; a forward or missing name fails with its location,
which makes local cycles impossible. `composes: name from global` works. A
`composes` from another file fails as cross-file composition. The default
export is a plain map of sorted local keys to space-joined values: the owning
scoped name first, then the composed names in authored order, repeats
included. Each key that is a valid, non-reserved JavaScript identifier is
also a named string export with the same value; other keys live on the
default map only. A plain CSS import supplies no class map.

### Loaders

`moduleResolution.loaders` reserves `.css` and `.module.css`; their only
allowed consumer value is `empty`. `.css: "empty"` opts out of both plain and
module CSS; `.module.css: "empty"` opts out of modules only. An opted-out
module supplies an empty default map, no named bindings, and no delivered
CSS; its file stays in the source inventory as a graph input. Any other CSS
loader fails configuration validation. No extension may use the consumer
`css` loader, because it would produce an undelivered sibling file; rename
the stylesheet to `.css` or choose a JavaScript-safe loader. A consumer
`file` loader on any JavaScript import fails the build: Mokly never exposes
extra graph outputs as public URLs.
