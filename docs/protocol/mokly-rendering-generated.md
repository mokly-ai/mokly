# Generated Rendering Contract

Continuation of [Mokly Rendering And Generated Output](./mokly-rendering.md).
The exact entry and view route builders are defined by
[Identity-Derived Artifact Paths](./mokly-artifact-paths.md); the manifest
shape is defined by [Manifest v7](./mokly-component-manifest.md).

## Generated Contract

`mokly build` writes deterministic output under `mockupsDir`:

- `screens/<id>.<viewport>.html` for each screen and screen variant;
- `components/<id>.<viewport>.html` for each component variant;
- the corresponding `.dark.html` view when its effective schemes include dark;
- `pages/<id>.html` for each complete page;
- `mokly-manifest.json` using schema version 7;
- `mokly-generated/styles/<repository-relative root module path>.css` for
  each renderer or entry root with imported CSS;
- `mokly-generated/assets/<repository-relative asset path>` for referenced
  local CSS assets, retaining opaque binary bytes.

Variant views use their own global id and normal kind prefix. Screen and
use-case entry routes are identities; a screen's views are bare product
renders, while a use case has no generated view document. Light views are
canonical and unsuffixed. Turning dark off makes previously generated dark
views orphans: Check reports them, and Build removes only proven owned output.
Every regular file below `mokly-generated/` is owned output and removed as an
orphan when absent from the next compilation. Imported CSS changes neither
the manifest schema nor the route derivation.

Generated fragment links use the full view route as their base, so links from
`screens/`, `components/` and `pages/` correctly reach configured public CSS
and generated CSS assets. Configured stylesheet links appear first, then the
generated renderer stylesheet, then the entry stylesheet, even when no
configured rule matches. The built-in renderer adds none; a custom renderer
emits the supplied links. Complete page callbacks receive no `RenderInput`
or injected links. Their entry CSS is generated but must be linked explicitly
with a relative path. Shell and device-frame CSS remains package-owned and
self-contained; product CSS is not copied into the npm package.

## Manifest And Ownership

Manifest v7 carries entry identities, authored `navPath`, source inventory,
declared dependencies, component usage, and effective color schemes. It stores
no derivable route, view path, `fragments`, `darkFragments`, or historical
collection record. Navigation hierarchy comes from each entry's authored
`navPath`, not from a collection. Current and baseline readers accept only v7;
recognized earlier output follows
[Baseline Compatibility](./mokly-baseline-compatibility.md). The manifest and
repository source paths use portable repo-relative POSIX names; generated
routes are `mockupsDir`-relative. Source inputs, dependencies and generated
files have deterministic ordering; optional absent values are omitted.

Generated HTML carries a generic generated-file header with its source path.
After compatibility transformation, each pending document must retain the
expected source attribution. The ownership parser accepts LF and CRLF. It
removes only files proven to belong to the configured catalogue, including an
orphan whose former source was just deleted; unknown or foreign files are
never removed. The same binary-safe transaction and committed/derived mode
rules apply to documents, stylesheets and local assets.
