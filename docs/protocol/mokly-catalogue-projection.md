# Catalogue Projection And Privacy

Continuation of [Catalogue Read Model](./mokly-catalogue.md).

## Projection And Privacy

The [projection and privacy contract](./mokly-catalogue-delivery.md#projection-and-privacy)
owns the public allowlist, usage projection, removal metadata and comparison
identity. These rules also apply to inline evidence.

Ready screen and saved-component views retain `inlineStyles` in their optional
`resourceEvidence`. The payload has the [inline evidence contract](./mokly-inline-style-evidence.md)'s
canonical shape; the catalogue does not copy private style coordinates or
invent a file path. Pending, unavailable and disabled evidence omits the field.
Whole-document page evidence has no inline payload.
