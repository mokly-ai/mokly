# Imported Stylesheet Assets And Delivery

Continuation of [Imported Stylesheet Delivery](./mokly-imported-styles.md).

## Assets, Links And Delivery

CSS `url()` values beginning `data:`, `http:`, `https:` (schemes matched
case-insensitively), `//` or `#` remain unchanged. A root-absolute `/...`
URL is invalid.
Quoted local string URLs inside `image-set()` are not validated by esbuild's
`url-token` hook; reject them, including in authored public CSS, with guidance
to write `image-set(url("./a.png") 1x)` instead. Resource reference extraction
also identifies strings inside `image-set()` for validation. They are never
treated as already-delivered CSS assets, whether the stylesheet is imported or
authored under `mockupsDir`. Quoted `data:`, `http:`, `https:` and `//` values
stay external and unchanged. A local `@import` at end of file without a
semicolon still belongs to the prelude and renderer closure. Relative URLs resolve
against the referring CSS file; strip `?query`/`#hash` for resolution and
restore that exact suffix after esbuild rewrites the relative path. Require a
regular confined file. A nested `@import` of a public stylesheet under
`mockupsDir` is likewise rejected before it can become an inventoried private
source. Compare both logical and physical locations with `mockupsDir` for
both kinds of source. An asset inside `mockupsDir` that is not already an
inventoried graph source fails instead of silently making an existing public
URL private; move the imported asset outside `mockupsDir` or keep it as a
separately linked public asset. In-repository `node_modules` assets are allowed and
their full repo-relative paths are mirrored. When that logical path is a
symlink into an in-repository workspace package, keep both logical and physical
source identities in the inventory and delivered-source evidence; physically
installed package code under `node_modules` is not inventoried. Only `.avif`, `.bmp`, `.gif`,
`.ico`, `.jpeg`, `.jpg`, `.png`, `.svg`, `.webp`, `.eot`, `.otf`, `.ttf`,
`.woff`, `.woff2` (matched case-sensitively) use esbuild's `file` loader.
Every other extension fails.
Serve, on-demand views and transient previews use the same extension-to-MIME
mapping for these assets: `.avif` `image/avif`, `.bmp` `image/bmp`, `.gif`
`image/gif`, `.ico` `image/vnd.microsoft.icon`, `.jpeg`/`.jpg` `image/jpeg`,
`.png` `image/png`, `.svg` `image/svg+xml`, `.webp` `image/webp`, `.eot`
`application/vnd.ms-fontobject`, `.otf` `font/otf`, `.ttf` `font/ttf`, `.woff`
`font/woff`, and `.woff2` `font/woff2`. Binary assets are never decoded.
`mokly-generated/assets/<path>` must satisfy the existing portable URL-path
rule segment by segment: `/^[A-Za-z0-9][A-Za-z0-9._~-]*$/`, no trailing
dot, and no Windows device-name stem (`aux`, `con`, `nul`, `prn`, `com1`–`9`,
`lpt1`–`9`, ignoring case). No empty, `.`, `..`, backslash, drive or colon
segments. **Only** the segment immediately after `node_modules` may instead
match `/^@[A-Za-z0-9][A-Za-z0-9._~-]*$/` (npm scope, e.g. `@fontsource`);
all other constraints remain, including for a stylesheet root inside a scoped
npm package. Esbuild emits the literal `@` in relative CSS
`url()` references; `encodeUrlPath` converts it to
`%40` for links, Serve decodes it, and export resource discovery accepts and
decodes both forms. The complete stylesheet route obeys the usual rule.

`RenderInput.stylesheets` is: first matching rule's shared paths, then its
scheme-specific paths, then configured renderer stylesheet if present, then
entry stylesheet if present; generated links exist even without a configured
rule. Resolve/encode local paths relative to each fragment route, e.g. from
`app/home.mobile.html` to `mokly-generated/styles/src/home.mockup.tsx.css`
is `../mokly-generated/styles/src/home.mockup.tsx.css`. Same order for dark,
component variants and saved viewports. The consumer renderer decides whether
to emit links; Mokly does not inject link tags. Pages receive no render input
or automatic link; they still cause an entry stylesheet to be generated and
can link it themselves with a relative URL. Pending generated routes are
valid link/resource targets before the transaction writes them.

The owning entry root is the **resolved entry module whose `mockups` or
default export yielded the definition** (including re-exports and flattened
nested definitions), not the module where its `define*` call ran. Record it
in memory during graph evaluation and propagate it through registry preparation
without adding a manifest field. Two entries may import the same helper but
link their own independent entry bundles.

Validation uses one generation-local pending set of HTML text, CSS text and
opaque asset bytes, seeded with all style outputs before rendering. On-demand
documents add HTML lazily to that same set; never decode asset bytes. Validate
generated CSS `url()` references recursively as CSS resources, and binary
assets by existence only. Pending generated routes satisfy stylesheet and
component resource checks; compatibility `availableRoutes` includes them.
The internal manifest is not a public pending resource, even though it is a
generated text output; links and component resources naming it retain the
existing internal-metadata rejection before the manifest exists on disk.
Ownership/orphan checks use the complete pending public set plus the internal
manifest output, not just HTML routes.
Never read a reserved route from disk during compilation: absent pending
reserved bytes mean a missing target even if an old file exists. On-demand
Serve responds to `/static/` generated CSS and assets from the accepted
generation's bytes, not on-disk files.
Full compilation continues to walk and validate transitive references in linked
authored public HTML; on-demand validation reads only the requested view and
resources it must validate for that request.
One accepted on-demand generation computes its pending orphan set once from
the complete route index and parses each generated CSS file at most once.
Subsequent view requests reuse both indexes while HTML and edited component
props remain request-specific. A new accepted generation owns fresh indexes;
the public validation rules and diagnostic order do not change.

Use esbuild `write: false`, `metafile: true`, `bundle: true`, `minify: false`,
`target: "esnext"`, `outbase: repoRoot`, path-mirroring
`assetNames: "../assets/[dir]/[name]"` relative to `styles/`, and no content
hashes, source maps or browser syntax lowering. Strip only esbuild-inserted
source-path comments and their separator blank lines, and end CSS with one
newline; Mokly does not otherwise rewrite PostCSS/CSS Modules/esbuild output.
Esbuild itself may drop ordinary authored comments or move legal comments,
even without minification. Repeated builds with the same
inputs and deterministic plugins yield byte-identical output; plugin
determinism is the consumer's responsibility.

`Compilation.outputs` carries text or raw bytes; compare, stage, roll back,
read and export by bytes. Build replaces only owned outputs transactionally
and removes stale files under the reserved directory. Committed Check compares
every compiled byte and reports extra files in that directory as orphans;
derived Check accepts missing/mismatched local output but rejects any
Git-tracked reserved-directory file with `git rm --cached` and one
`/<mockupsDir-relative-from-repoRoot>/mokly-generated/` `.gitignore` rule.
Serve `/static/<encoded-route>` and transient previews prefer this generation's
compiled stylesheet/asset bytes over old disk files (correct content types,
GET/HEAD, confined paths). Retained Serve runtimes carry per-root stylesheet
routes and the CSS/asset outputs as raw bytes through the worker and watched
child IPC boundaries. Recompiling an accepted JavaScript graph reuses those
outputs without rescanning CSS; runtime transfer may not lose the route map
or decode assets as UTF-8. An imported CSS, nested import, asset, config or
plugin-dependency edit rebuilds; new matching files in watched dependency
directories also rebuild. Ordinary linked authored public CSS changes still
reload. Committed export/publication capture checked disk bytes; derived
export/publication and Changes capture validated compilation bytes, including
binary assets, and keep imported sources private. Generated linked stylesheets
are public resources analyzed by [CSS change attribution](./mokly-css-attribution.md);
their original private CSS inputs are dependency evidence, not independently
analyzed public sheets. The first derived baseline using the older toolchain
lacks these links, so affected views show a one-time Changes jump; later
baselines settle on the new output.
