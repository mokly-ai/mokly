# Front Matter YAML

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

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

## Related Docs

- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [Entry props and variants](./mokly-entry-props.md)
