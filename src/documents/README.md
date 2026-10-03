# Markdown catalogue documents

This internal module turns discovered Markdown files into document entries.
The file is the definition. Consumers need no React component or authoring helper.

`front_matter.ts` implements the strict, pure metadata grammar. `markdown.ts`
uses one fresh Marked instance per render. It escapes raw HTML, generates heading
ids, retains code languages, and delegates destination rewriting. Parsing and
rendering never read files. `template.ts` owns the script-free light/dark document.

`load.ts` applies shared root/path rules and title fallbacks. `destinations.ts`
owns confined repository reads. File links use the source directory; `mock:`
links use the resolved entry's ordinary or index base. Source-file links become
plain text and join the private source inventory, so direct HTTP requests
cannot expose them. Copyable resources remain byte-exact and join source watching.
`resource_paths.ts` reconstructs their public paths from manifest metadata so
transactions can replace and remove only proven generated copies.

The graph retains documents and asset bytes for demand rendering and worker
replay. Build applies the same ownership, compatibility, final-link, resource
and transactional checks as pages. Manifest v8 records source resources; public
catalogue v4 exposes documents without source bytes. Changes compares rendered
documents in each scheme, resources and reviewable metadata. Removed previews
capture historical schemes and resources through the existing baseline reader.
`moved_resources.ts` proves equal bytes at corresponding resource references
for one document pair. That proof cannot suppress changes in another document.
`references.ts` shares discovered-document links between public projection and
move-aware metadata comparison.

```sh
npm run build
node --import tsx --test tests/documents_*.test.ts
npx playwright test tests/browser/markdown_documents.spec.ts
```

See [the document contract](../../docs/protocol/mokly-documents.md),
[Build](../build/README.md), and [Review](../review/README.md).

`resource_references.ts` follows declared attachment links in normalized HTML.
Changes and historical capture therefore include PDFs and linked images without
following unrelated source links or restoring paired ignored regions.
