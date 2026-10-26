# Imported Stylesheet Assets And Delivery

Continuation of [Imported Stylesheet Delivery](./mokly-imported-styles.md).

## Assets, Links And Delivery

A CSS `url()` value that begins with `data:`, `http:`, `https:`, matched
case-insensitively, `//`, or `#` stays unchanged. A root-absolute `/...` URL
is invalid. A quoted string URL inside `image-set()` is rejected, with the
guidance to write `image-set(url("./a.png") 1x)`; the same rule applies to
authored public CSS under [link validation](./mokly-link-validation.md), and
such a string is never an already-delivered asset. Quoted `data:`, `http:`,
`https:`, and `//` values stay external. A local `@import` at the end of a
file without a semicolon still belongs to the prelude.

A relative URL resolves against the referring stylesheet; `?query` and
`#hash` are removed for resolution and restored on the rewritten route. The
target must be a regular file inside the repository, reached without a
symbolic link; a missing, non-regular, or escaping target fails. An imported
asset and a nested `@import` target are protected inputs of the source
inventory; a document that references one of them as a public file fails
with the protected-target diagnostic of the
[referenced closure](./mokly-public-closure.md), whose reason names the
importing stylesheet. An in-repository `node_modules` asset is allowed
and its full repository-relative path is mirrored; when that logical path is
a symlink into an in-repository workspace package, both the logical and the
physical identity enter the inventory, and physically installed package code
is not inventoried.

Only these extensions, matched case-sensitively, are assets; every other
extension fails. Serve and the static output use the same content types:

| Extension       | Content type                    |
| --------------- | ------------------------------- |
| `.avif`         | `image/avif`                    |
| `.bmp`          | `image/bmp`                     |
| `.gif`          | `image/gif`                     |
| `.ico`          | `image/vnd.microsoft.icon`      |
| `.jpeg`, `.jpg` | `image/jpeg`                    |
| `.png`          | `image/png`                     |
| `.svg`          | `image/svg+xml`                 |
| `.webp`         | `image/webp`                    |
| `.eot`          | `application/vnd.ms-fontobject` |
| `.otf`          | `font/otf`                      |
| `.ttf`          | `font/ttf`                      |
| `.woff`         | `font/woff`                     |
| `.woff2`        | `font/woff2`                    |

Binary assets are never decoded. `assets/<path>` satisfies the portable
URL-path rule segment by segment: `/^[A-Za-z0-9][A-Za-z0-9._~-]*$/`, no
trailing dot, and no Windows device-name stem (`aux`, `con`, `nul`, `prn`,
`com1` to `com9`, `lpt1` to `lpt9`, ignoring case); no empty, `.`, `..`,
backslash, drive, or colon segment. Only the segment directly after
`node_modules` may instead match `/^@[A-Za-z0-9][A-Za-z0-9._~-]*$/`, an npm
scope such as `@fontsource`; every other constraint still applies, including
for a stylesheet root inside a scoped package. The rewritten `url()` carries
the literal `@`; a link encodes it as `%40`, Serve decodes it, and the
referenced closure accepts and decodes both forms.

The [renderer stylesheet contract](./mokly-rendering.md#renderer-stylesheets)
owns the complete stylesheet list of a document, its order, href encoding,
and how pages link CSS. The owning entry root of a definition is the entry
module or stories file whose export contributed it, under the
[entry module contract](./mokly-entry-modules.md), independent of the module
where its `define*` call ran; the definition's handle names that file. Two
entries may import the same helper and still link their own bundles.

## Validation And The Render Cache

Validation of one render generation covers the composed documents, the
bundled stylesheet text, and opaque asset metadata. Every stylesheet route of
the generation, with its assets, is a valid target before any document is
validated, and a document that renders on demand is validated against the
same routes. A
bundled stylesheet's `url()` references are validated recursively as CSS
resources; an asset by existence only. A pending route satisfies stylesheet
and component resource checks before anything is served or written. Nothing is
read from disk by route: an absent pending route is a missing target.

An opaque asset keeps its generated route, logical path, confined source
identity, and captured SHA-256 digest. Stylesheet and document keys include
the digest.

Serve answers `GET` and `HEAD` for `/static/mokly-generated/styles/<route>`
and `/static/mokly-generated/assets/<route>` with the generation's bytes, the
content types above, and confined paths. There is no disk fallback, and a
route absent from the current generation is not found even when an earlier
generation had it. Transient component renders of the
[component controls contract](./mokly-component-controls.md) use the same
bytes. `build` writes every stylesheet and asset of its generation under
`static/mokly-generated/`; publish uploads that output; the comparison
contract reads the base side's bundles from the base commit's sources.
Imported CSS, PostCSS, and asset sources never enter the static output.

Delivery checks the complete asset against the generation digest and its
opened length before Serve sends headers. A mismatch fails the request, and
watched Serve then requests a new generation. With `--no-watch`, the
generation stays fixed. The terminal diagnostic names the asset and tells the
user to restart Serve or use watching. Static output captures one immutable
final payload after its file-size check.
A mismatch stops the build with the input-change error before installation;
publish uses the final captured bytes. The final live fingerprint recheck
still applies under [Output Transaction](./mokly-export.md#output-transaction).

A vanished path (a missing file, or a parent that is no longer a directory),
stopped symbolic-link resolution or a symbolic-link loop, and a non-regular
replacement count as changed inputs. Other open failures keep their original
IO diagnostic and do not request regeneration. Explicit command cancellation
stops the copy with the cancellation diagnostic.

A base-side asset is bounded by the 64 MiB output bound of the
[Git runtime](./mokly-git.md).

An edit to an imported stylesheet, a nested import, an asset, the
configuration, or a plugin-reported dependency invalidates the stylesheet
node and re-renders the views that link it; a new file that matches a
watched directory dependency does the same. An edit to an authored public
stylesheet reloads the views that link it under the
[watch contract](./mokly-watch.md).

Delivered stylesheets are public resources that
[CSS change attribution](./mokly-css-attribution.md) analyses; configured,
declared, CSS-imported, and JavaScript-bundled rules follow
[one membership rule](./mokly-css-attribution-rules.md). A changed asset is
conservative evidence for every view whose closure reaches it, without
decoding it. Both sides of a comparison render with the current Mokly
version, so no old resource reader exists.
