# Browse document adaptation

`adaptBrowseDocument(content, route, catalogue)` authenticates current published
HTML copies for Serve and export. It never writes generated source files or
comparison snapshots. `trusted_document.ts` derives ownership and the expected
portable href from the current manifest; unowned resources receive no inspector.

The adapter checks the ownership header, complete component marker forest,
native logical links, duplicate reserved attributes and portable destinations
before adding package metadata. It preserves live hrefs and targets, deriving
only the trusted target metadata that parent navigation consumes. Unowned HTML
has existing reserved navigation attributes stripped from the published copy.

`inspector_metadata.ts` supplies one inert template and the deferred inspector
script. The compact map contains range/parent tuples and logical identities,
bounded to 1,024 keys, 4,096 ranges, 1,024 distinct links and 262,144 UTF-8 bytes.
Overflow emits an explicit `limit` state instead of partial inspection data.
The script remains disabled in ordinary local frames. Consumer-authored copies
of the package's inspector metadata marker fail closed on owned documents.
Publication inserts both nodes in the head, preserving body child positions and
their selectors, including documents with implicit head/body tags. Accepted native
links receive indices into the deduplicated `links` array; authored occurrences
of this private index attribute are rejected too.

```bash
npm run build
node --import tsx --test tests/browse_document_adapter.test.ts tests/inspector_publication.test.ts
```

See [navigation](../../docs/protocol/mokly-navigation.md),
[frame inspection](../../docs/protocol/mokly-frame-adapter.md),
[inspector implementation](../../packages/viewer/src/inspector/README.md), and
[export assembly](../export/README.md).
