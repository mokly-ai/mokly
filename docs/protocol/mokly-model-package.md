# Model Package

This continues the [embeddable viewer contract](./mokly-viewer.md).

## Package And Entry

`@mokly/model` is an MIT, ESM npm package under `packages/model`. It holds the
catalogue rules and types that the [frame package](./mokly-frame-package.md)
and the viewer share:

- the path grammar of the [path contract](./mokly-paths.md), and the link and
  fragment grammar of the [authoring links contract](./mokly-authoring.md#links);
- the static path of a current generated document and its inverse route, which
  [frame mapping](./mokly-artifact-paths.md#frames-and-reverse-mapping) uses;
- the route prefix and the id grammar of the temporary renders of the
  [component controls contract](./mokly-component-controls.md);
- the directory names of the
  [viewer namespace](./mokly-viewer-namespace.md#paths-and-single-ownership);
- the generated TypeScript types of the Rust model crate.

The package has one entry, its root. The routes and the prop schema validators
stay in the viewer.

## Package Boundary

`@mokly/frame` and `@mokly/viewer` each depend on the exact released version
of `@mokly/model`. The model package never imports the viewer, the frame
package, the CLI, or consumer code. Decision: a separate lockstep package, not
a home inside the frame package, rules that the viewer passes in, or one
private source built into each package, so that each rule has one home that
later packages can use.

`@mokly/viewer/data` keeps every export that the
[viewer contract](./mokly-viewer.md) lists. It re-exports the rules of this
package that it lists, and it holds no second implementation of them.

Decision: the name `@mokly/model`, not `@mokly/data`, `@mokly/catalogue`, or
`@mokly/contract`, because the package and the Rust crate `mokly-model`, which
writes its types, share one name.

## Release

The package releases in lockstep with `@mokly/mokly`, `@mokly/viewer`,
`@mokly/ui`, and `@mokly/frame`, at their one shared version, under the
[release contract](./npm-release.md#package-set).
