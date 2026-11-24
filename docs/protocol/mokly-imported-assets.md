# JavaScript Asset Imports

This page defines the files that JavaScript imports as assets, such as
`import logo from "./logo.png"`. Such an import gives an asset token. Each
composed document gets the URL of the delivered file in place of the token.
The delivered file uses the routes and the delivery of
[stylesheet assets](./mokly-imported-styles-assets.md). The page also gives
the order in which an import attribute and the loaders choose the value of
each JavaScript import, and the [content type](#content-types) of each file
that Serve or Mokly Cloud delivers.

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

Serve and Mokly Cloud send the content types of this table under the
[content type rule](#content-types). A stylesheet `url()` keeps the extension
list of the stylesheet asset table. The types of this table are assets only
when JavaScript imports them.

Decision: the asset types are the types that Vite knows, without `.txt`.
Vite and Storybook turn these imports into URLs, and a `.txt` import keeps its
text. Rejected: the stylesheet asset list alone, because a media or PDF import
that works in Storybook would then fail.

## Content Types

One rule by file extension gives the content type of each file that Serve or
Mokly Cloud delivers. The first step that gives a type wins:

1. The type of the [table of imported types](#imported-types) or of the
   [stylesheet asset table](./mokly-imported-styles-assets.md#assets-links-and-delivery),
   or `text/plain; charset=utf-8` for `.txt`.
2. The common media type of the extension. A `text/*` type and
   `application/json` get `; charset=utf-8`.
3. `application/octet-stream`, when no type is known.

The path of the file does not change the type. So a generated asset, an
authored file, and a published file with the same extension get the same
type. A host of the static output sends the types of the first step, under the
[static delivery contract](./mokly-export-delivery.md#hosting-contract).

Decision: the extension alone gives the type. Rejected: a lookup that knows the
paths of generated assets, because a new path form could escape it.

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

A composed document that holds an imported asset URL fails its render when its
first `<base href>`, resolved against the document URL, has another origin or
another directory than the document URL. The browser would resolve the asset
URL against that base, not against the route of the document. The failure is
`build-invalid`, with this reason, where `<route>` is the route of the
document:

```text
<route>: <base href> redirects the imported asset URLs of this document; remove <base href>
```

Serve does not serve such a document, and `build` fails, as for other render
failures. A base URL that keeps the directory of the document stays valid, and
so does `<base target>`.

Decision: this rule fails a document only when its base redirects an imported
asset URL, because the asset URLs of such a document are broken. Rejected: a
failure for every `<base href>`, because it also fails documents that work.
Rejected: asset URLs written against the base, because the shared closure would
then resolve authored references against the base too.

## Delivery

Each imported asset of the [module graph](./mokly-sidecar.md#bundling) of a
generation joins that generation, also when no document references it. Its
route is `static/mokly-generated/assets/{logical-path}`. The route follows the
portable path rule of
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
- [Document Rendering Safety](./mokly-document-safety.md)
- [Public File Policy And Referenced Closure](./mokly-public-closure.md)
- [Changes and screen comparisons](./mokly-changes.md#resources)
