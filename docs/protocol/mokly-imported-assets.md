# JavaScript Asset Imports

Status: Under the Vite adapter, the asset token and delivery rules of this page are not available yet. The [Vite asset milestone](../../plans/storybook-support.md#milestone-31-imported-assets-on-the-vite-adapter) adds them.

This page defines the files that JavaScript imports as assets, such as
`import logo from "./logo.png"`. Such an import gives an asset token. Each
composed document gets the URL of the delivered file in place of the token.
The delivered file uses the routes and the delivery of
[stylesheet assets](./mokly-imported-styles-assets.md). The page also gives
the order in which an import attribute and the loaders choose the value of
each JavaScript import.

Decision: Mokly delivers each imported asset as a file, and it gives each
document its own URL to that file. This reuses the delivery of stylesheet
assets. Rejected: a `data:` URL as the value of the import, because the
[URL policy](./mokly-document-safety.md#url-policy) rejects it in `src` and
`href`. Rejected: serving Storybook `staticDirs` as well, which is out of
scope.

## Imported Types

A file has an asset type when its name ends with an extension of the
[stylesheet asset table](./mokly-imported-styles-assets.md#assets-links-and-delivery)
or of the table below. The match of an extension is case-sensitive, as for
stylesheet assets. The file of an asset import is an imported asset. These
rules choose the value of a JavaScript import. The first rule that applies
wins:

1. An import attribute `type` of `json`, `text`, or `bytes`, such as
   `with { type: "bytes" }`, gives the parsed JSON, the text, or the bytes of
   the file.
2. A consumer `moduleResolution.loaders` entry applies, under the
   [module resolution rules](./mokly-configuration.md#module-resolution). Its
   key is the longest configured key that ends the file name, as in esbuild.
   A `file` loader follows the `file` rules below.
3. Mokly's own loaders read JavaScript, TypeScript, JSON, and CSS. A `.txt`
   import gives the text of the file.
4. An import of a file with an asset type is an asset import.
5. An import of any other file fails the bundle with `bundle-failed`, under
   the [bundling rules](./mokly-sidecar.md#bundling).

A `.css` or `.module.css` import is the exception to these rules. It stays a
stylesheet import under the
[imported stylesheet contract](./mokly-imported-styles.md), also with an import
attribute. That contract also gives its loader rules.

Under the [Vite adapter](./mokly-vite-adapter.md#moklys-plugin), the setup,
not these rules, chooses the value of each import that is not a stylesheet.

Decision: the import attribute wins over every loader, as in esbuild.
Rejected: a configured loader first, because an import then gets another value
than in the product's own esbuild build.

A consumer `file` loader gives an asset import for a file with an asset type
or the extension `.txt`. For every other file, the `file` loader fails the
bundle with the
[diagnostic](./mokly-imported-styles-errors.md#build-build-invalid) that names
the file. Mokly delivers a `.txt` file only through a `file` loader.

Decision: a `file` loader gives an asset import for each type that Mokly can
deliver. Rejected: a failure for every `file` loader, because Mokly can deliver
the file, and a failure only makes the project delete the entry.

| Extension                 | Content type                |
| ------------------------- | --------------------------- |
| `.apng`                   | `image/apng`                |
| `.cur`                    | `image/x-icon`              |
| `.jfif`, `.pjp`, `.pjpeg` | `image/jpeg`                |
| `.jxl`                    | `image/jxl`                 |
| `.aac`                    | `audio/aac`                 |
| `.flac`                   | `audio/flac`                |
| `.m4a`                    | `audio/mp4`                 |
| `.mov`                    | `video/quicktime`           |
| `.mp3`                    | `audio/mpeg`                |
| `.mp4`                    | `video/mp4`                 |
| `.ogg`, `.opus`           | `audio/ogg`                 |
| `.wav`                    | `audio/wav`                 |
| `.webm`                   | `video/webm`                |
| `.pdf`                    | `application/pdf`           |
| `.vtt`                    | `text/vtt`                  |
| `.webmanifest`            | `application/manifest+json` |

Serve sends the content types of this table under the
[content type rule](./mokly-content-types.md). Mokly Cloud records them when it
accepts a publication, and it sends the recorded types. A stylesheet `url()`
keeps the extension list of the stylesheet asset table. The types of this table
are assets only when JavaScript imports them.

Decision: the asset types are the types that Vite knows, without `.txt`.
Vite and Storybook turn these imports into URLs, and a `.txt` import keeps its
text. Rejected: the stylesheet asset list alone, because a media or PDF import
that works in Storybook would then fail.

## Asset Tokens

The value of an asset import is an asset token, a string. The token depends
only on the logical repository-relative path of the imported asset. Equal
paths give equal tokens. An edit to the bytes of the asset changes no token.
This contract does not fix the format of a token.

Code puts the token where the output needs the URL of the asset, for example
in the `src` of an `img`. Code can append a `?query` or a `#fragment` to the
token. A token is not a URL that a browser can load. Code that needs the bytes
of the file during a render uses a consumer `binary` or `text` loader, or an
import attribute. Records that carry a prop value, such as
[usage records](./mokly-component-usage-records.md) and
[component props](./mokly-component-props.md#canonical-wire-props), keep the
token.

## Asset URLs In Documents

While it composes a document, the core replaces each asset token of its
generation with the URL of the delivered asset. It replaces a token in each
attribute value, in text, and in the
[collected styles](./mokly-sidecar.md#style-collection) in the head. The URL
keeps a query or a fragment that code appended to the token. The URL is
relative to the route of that document, so one fragment in two documents at
different depths gets a different URL in each. The URL encodes the route as a
[stylesheet asset link](./mokly-imported-styles-assets.md#assets-links-and-delivery)
does. The [URL policy](./mokly-document-safety.md#url-policy) and the
[referenced closure](./mokly-public-closure.md#referenced-closure) check the
document after the replacement, as after
[logical-link rewriting](./mokly-logical-links.md#composition).

Only a URL in a reference position of the
[comparison resource rule](./mokly-comparison.md#resources) makes the asset a
resource reference of the referenced closure and of Changes. The core also
replaces a token in another position, such as `data-src`, but that URL is not
a resource reference.

The replacement does not depend on the assets of the generation. A string in
token form also becomes a URL when its path names no asset of the generation.
A reference to that URL then fails the referenced closure as a missing target.
No attribute value, text, or collected style of a served or written document
holds a token.

Decision: the assets of a generation are not an input of the replacement.
Rejected: a replacement only for the delivered paths, because the key of each
document would then hold the asset list, and one new import would render every
view again.

### Base URLs

A composed document that holds an imported asset URL fails its render when a
base URL changes the destination of one of those URLs. The destination of an
asset URL is the URL resolved against the effective base of the document that
holds it. It must equal the URL resolved against the address of the composed
document. The effective base is the document base URL that HTML defines. It
comes from the first `<base href>` of the document, resolved against that
address. A document without one uses its address.

An `<iframe srcdoc>` document follows the same rule with its own first
`<base href>`. That base resolves against the effective base of the document
that holds the iframe. A `srcdoc` document without one uses that outer
effective base. A nested `<iframe srcdoc>` document follows the rule in the
same way.

Mokly checks each destination at each address where it shows the composed
document, on any origin:

- `static/mokly-generated/<route>` in Serve and the static output, under the
  [artifact layout](./mokly-artifact-paths.md#layout)
- `mokly-viewer/diffs/generations/<generation>/snapshots/<side>/mokly-generated/<route>`
  in Changes and removed previews, under the
  [comparison and preview paths](./mokly-artifact-paths.md#comparison-and-preview-paths)

The failure is `build-invalid`, where `<route>` is the route of the composed
document. A base of the composed document gives the first reason. A base in an
`<iframe srcdoc>` document gives the second reason:

```text
<route>: <base href> redirects the imported asset URLs of this document; remove <base href>
<route>: <base href> in an <iframe srcdoc> document redirects its imported asset URLs; remove <base href>
```

Serve does not serve such a document, and `build` fails, as for other render
failures. A base that keeps each destination stays valid. Examples are a base
in a sibling directory at the same depth, and `./`. `<base target>` stays valid
too.

Decision: this rule fails a document only when a base changes the destination
of an imported asset URL, because those asset URLs are broken. Rejected: a
failure for every `<base href>`, and a failure for every base in another
directory, because both fail documents that work. Rejected: asset URLs written
against the base, because the shared closure would then resolve authored
references against the base too.

## Delivery

Each imported asset of the [module graph](./mokly-sidecar.md#bundling) of a
generation joins that generation, also when no document references it. Its
route is `static/mokly-generated/assets/{logical-path}`, with the logical path
in the [route form](./mokly-imported-styles.md#routes-and-ownership) of
stylesheet routes. The route follows the portable path rule of
[stylesheet assets](./mokly-imported-styles-assets.md#assets-links-and-delivery).
A stylesheet asset at the same logical path shares the route and its bytes. An
imported asset whose route is not portable fails the build with the
[diagnostic](./mokly-imported-styles-errors.md#build-build-invalid) that names
the asset file and the importing module.

An imported asset follows the rules of stylesheet assets in these points:

- Its location and its logical name follow the
  [stylesheet asset rules](./mokly-imported-styles-assets.md#assets-links-and-delivery)
  and the
  [dependency file names](./mokly-sidecar-modules.md#source-and-dependency-files).
- It is a protected input of the
  [source inventory](./mokly-source-protection.md#complete-source-inventory).
  A document that links its authored path fails as a protected target, with
  the [reason](./mokly-imported-styles-errors.md#build-build-invalid) of an
  imported stylesheet asset. That reason names the importing module.
- The digest and length checks and the verified copies of Serve, `build`,
  and publish follow
  [generation delivery](./mokly-imported-styles-assets.md#validation-and-the-render-cache).
  Validation checks only that the asset exists. Mokly never decodes it.
- [Comparison snapshots](./mokly-comparison-serving.md#generation-and-serving)
  hold it as a transitive resource of the documents that reference it.
- The base side reads it from the base commit under the
  [comparison tiers](./mokly-comparison.md#sides). The 64 MiB bound of a
  base-side stylesheet asset applies.

## Keys, Watch, And Changes

An edit to an imported asset changes the key of each document whose
definition imports the asset. The import can be direct, or through another
module of the
[render input closure](./mokly-watch.md#invalidation-through-the-render-graph).
Watched Serve then reloads those views. A changed imported asset is
conservative evidence for each view that references it, under the
[comparison resource rule](./mokly-comparison.md#resources).

## Related Docs

- [Imported Stylesheet Assets And Delivery](./mokly-imported-styles-assets.md)
- [Imported Stylesheet Diagnostics](./mokly-imported-styles-errors.md)
- [Content Types](./mokly-content-types.md)
- [Document Rendering Safety](./mokly-document-safety.md)
- [Public File Policy And Referenced Closure](./mokly-public-closure.md)
- [Changes and screen comparisons](./mokly-changes.md#resources)
