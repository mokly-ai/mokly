# Logical Link Composition

This continues the [navigation contract](./mokly-navigation.md#logical-catalogue-links),
which defines the link forms, the fragment grammar, and the target grammar.
This page defines what the core writes while it composes a document.

## Composition

While it composes a document, the core must:

- validate the destination path and optional fragment before the document is
  served or written;
- rewrite the actual `href` and `data-nav-href` to the relative document URL
  of the destination for the source viewport and colour scheme, with light
  fallback;
- add one package-owned `data-mokly-link` marker holding the resolved complete
  `<path>[#fragment]` destination only to an activatable native link;
- remove any consumer-authored `data-mokly-target`, parse the eligible link's
  effective request from its own `target` or the document's applicable first
  `<base target>`, and keep a valid non-self request only in newly derived
  inert `data-mokly-target` metadata; and
- reject a logical `href` on any other element, a `<base href>` in a document
  with an activatable logical link, a reserved marker supplied by consumer
  output, duplicate occurrences of either reserved navigation attribute, or
  conflicting logical destinations carried by two navigation attributes on
  one element.

The [final link validation contract](./mokly-link-validation.md) defines
reference records, final anchor checks and Markdown safety. No consumer
transformation runs after rewriting. The marker is inert metadata, not a
second resource URL: HTML escaping is deterministic, link and resource
validation inspect the portable attributes, and markers never grant resource
access. Raw relative links do not become catalogue links merely because they
resolve to a composed document, so catalogue intent stays explicit and Mokly
never takes over product or asset navigation by accident.

## Related Docs

- [Catalogue navigation](./mokly-navigation.md)
- [Final logical link validation](./mokly-link-validation.md)
- [Styled catalogue link controls](./mokly-link-controls.md)
- [HTML screens, pages, and use cases](./mokly-html-screens.md#links-and-markers)
- [Public authoring contract](./mokly-authoring.md)
