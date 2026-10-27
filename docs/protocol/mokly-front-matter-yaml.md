# Front Matter YAML

The front matter block of a screen, component, or page file and a whole use
case file are YAML. A file that breaks a rule here fails with
`html-front-matter`.

## Decoding

The YAML uses the 1.2 core schema: duplicate keys fail, custom tags fail,
aliases are allowed, and `no` stays a string. An alias decodes as a copy of
its anchored value.

## Limits

A value sits at most 128 levels below the root of its file, where the root
is level 0. A deeper value fails where it starts. An alias counts at the
depth of the deepest value in its copy.

Decision: the bound is 128 levels, about twice the 67 levels of the deepest
valid front matter, in variant props. A bound of 64 levels, the props bound,
was rejected because it rejects valid front matter. Without a bound, deep
YAML could stop Serve or a build before validation reports it.

The aliases of a file expand to at most 1,000,000 nodes. An alias expands
to every node of its anchored value, mapping keys included. A file whose
aliases expand to more fails at the alias that passes the bound.

Decision: a fixed bound stops chains of aliases, which let a short file
expand to billions of nodes, before Mokly copies a value. Rejecting aliases
was the alternative, and it was rejected because authors share values with
them.

## Related Docs

- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [Entry props and variants](./mokly-entry-props.md)
