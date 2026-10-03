# Catalogue move pairing

`pair.ts` owns the pure ordered policy. Callers supply validated entry metadata
and injectable content signals. `pass.ts` evaluates complete candidate sets
before accepting unique mutual matches. Ambiguous candidates cannot enter a
later pass. `similarity.ts` implements the exact light-document line score.

`read.ts` loads candidate documents through the existing confined asset reader.
`content.ts` supplies rendered-content and similarity signals, including flow
steps and component-parent structure. `identity.ts` maps baseline references
without confusing a path reused by another kind.

`links.ts` changes catalogue link attributes in comparison material only. It
feeds the existing paired ignore normalizer; it never rewrites source documents
or captured snapshot bytes. Input resources and ordinary external links stay
unchanged.

```sh
npm run build
node --import tsx --test tests/move_*.test.ts
```

See the [move contract](../../../docs/protocol/mokly-moves.md) and the
[comparison module](../README.md).
