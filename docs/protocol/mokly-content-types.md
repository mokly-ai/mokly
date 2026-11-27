# Content Types

This page gives the content type of each file that Serve, a host of the static
output, or Mokly Cloud sends.

## Content Type Rule

One rule by file extension gives the content type of a file. The first step
that gives a type wins:

1. The type of the
   [table of imported types](./mokly-imported-assets.md#imported-types) or of
   the
   [stylesheet asset table](./mokly-imported-styles-assets.md#assets-links-and-delivery),
   or `text/plain; charset=utf-8` for `.txt`.
2. The common media type of the extension. A `text/*` type and
   `application/json` get `; charset=utf-8`.
3. `application/octet-stream`, when no type is known.

The path of the file does not change the type. So a generated asset and an
authored file with the same extension get the same type.

Decision: the extension alone gives the type. Rejected: a lookup that knows the
paths of generated assets, because a new path form could escape it.

## Delivery

Serve sends the type of the rule with each file that it delivers. A host of the
static output sends the types of the first step, under the
[static delivery contract](./mokly-export-delivery.md#hosting-contract).

Mokly Cloud applies the rule when it accepts a publication. It records the type
of each path and sends that recorded type. A recorded type does not change.

## Related Docs

- [JavaScript Asset Imports](./mokly-imported-assets.md)
- [Imported Stylesheet Assets And Delivery](./mokly-imported-styles-assets.md)
- [Static Delivery](./mokly-export-delivery.md)
