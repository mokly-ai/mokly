# Catalogue definitions

The public package exposes `defineScreen`, `definePage`, `defineUseCase`,
`defineComponent`, `defineFolder`, `MockLink` and `mockLink`. Definitions accept an
optional slug and complete path override; the discovered exporting module supplies
the default location. `movedFrom` records an authored previous path.

Generic `defineScreen` wrappers retain precise return types. Fresh variant
literals in direct calls receive excess-key checks; generic inference can accept extra top-level
keys. Use `satisfies ScreenInput` for static checks there. Registry preparation
rejects all unknown fields, including through structurally typed variables.

A screen without a variants array returns one definition. A present array returns
parent-first definitions, including for an empty array. Components return a typed
renderable facade and their parent-first entries. Export those values directly or
spread entries into an exported array; nested arrays containing definitions are rejected, while nested helper data is ignored.

Links accept complete or explicitly relative paths, an imported definition, a
parent-first definition array, or a component registration. References created at
module load resolve when the registry knows their paths. Relative link and flow
bases are shared: ordinary entries use their parent path, indexes their own path,
and variants their parent's base. Fragment values remain separate bare HTML ids.

Private registry symbols retain branding, variant ancestry, field diagnostics and
resolved reference state across the consumer bundle. `__attributeDefinition` binds
source attribution without replacing object identity. Review-ignore ids and their
material-key behavior remain independent of catalogue paths.

```sh
node --import tsx --test tests/authoring*.test.ts tests/authoring*.test.tsx
node --import tsx --test tests/entry_exports.test.ts tests/nav_path_authoring.test.ts
```

See [authoring](../../docs/protocol/mokly-authoring.md),
[entry modules](../../docs/protocol/mokly-entry-modules.md), and
[links](../../docs/protocol/mokly-navigation.md).
