# Imported CSS Configuration

Continuation of [Mokly Configuration](./mokly-configuration.md). The
[imported stylesheet contract](./mokly-imported-styles.md) owns delivery and
the [error catalogue](./mokly-imported-styles-errors.md) owns diagnostics.

## PostCSS Module

`postcss` optionally names a config-relative local module inside `repoRoot`.
Mokly inventories its local imports, loads consumer plugin packages unbundled,
and isolates plugin state per graph load. PostCSS 8-compatible arrays include
instances, uncalled creators, plain functions and `{ postcss: fn }` objects;
ordered package-name records are also accepted. ESM imports and CommonJS
`require()` use their respective Node resolution conditions. The complete
module format, loading, transform and dependency contract is
[Imported Stylesheet PostCSS](./mokly-imported-styles-postcss.md).

## Loader And Output Boundaries

Mokly owns `.css` and `.module.css` handling. At those keys,
`moduleResolution.loaders` accepts only `"empty"`: `.css` skips both plain
and module CSS, while `.module.css` skips only module CSS and its class map.
Opted-out CSS remains inventoried. A `file` loader on another
JavaScript-imported asset fails Build. A consumer `css` loader on any extension
is rejected at config validation because it emits an undelivered sibling
stylesheet; rename the input to `.css` or use a JavaScript-safe loader.

`<mockupsDir>/mokly-generated/` is reserved for generated HTML, the private
manifest, compiled stylesheets and copied binary assets. A root directory or `roots[].files` static prefix cannot select it;
`review.outDir` cannot equal or be inside it, and broad
entry discovery skips it. Local configured stylesheet paths and authored
inputs cannot live there, including through symlink aliases. `publicExclude`
is removed; supplying it fails configuration validation. Authored public CSS
belongs elsewhere below `mockupsDir` and enters the referenced asset closure.
The [unified output contract](./mokly-unified-output.md) defines route reservation,
source boundaries and output-independent command behavior.

Configured stylesheet links precede generated renderer and entry links in
each rendered view. The renderer link precedes the entry link, even if no
configured stylesheet rule matches. The built-in renderer adds no stylesheet;
complete page callbacks must link their generated entry CSS explicitly.
