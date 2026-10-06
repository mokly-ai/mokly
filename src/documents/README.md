# Markdown catalogue documents

Parsed Markdown bodies remain private in the document definition and accepted
compilation. Move similarity compares those bodies with inventoried source bytes
at the pinned baseline commit. Generated template lines supply no similarity
signal. Rendered HTML still owns material change classification.

This internal module turns discovered Markdown files into document entries.
The file is the definition. Consumers need no React component or authoring helper.

`front_matter.ts` strips one leading BOM before the strict, pure metadata grammar.
`markdown.ts` uses one fresh Marked instance per render and escapes raw-mode text
as well as HTML tokens. It decodes CommonMark references once, skips empty title
headings, omits empty ids, retains code languages and delegates destinations.
Parsing and rendering never read files. `template.ts` owns the script-free
light/dark document; its stylesheet follows the `design/browse/pages/document`
design, which `tests/browser/document_typography.spec.ts` compares property by
property. After link rewriting, `safety.ts` parses the final
HTML and enforces the element, attribute and URL allowlist independently. Serve's
owned inspector still needs scripts, so the template adds no blanket CSP meta.

`load.ts` applies shared root/path rules and title fallbacks; index duplicates use
exact directory spelling before shared case-collision validation. `destinations.ts`
and `destination_files.ts` own confined repository reads and attributed errors.
File links use the source directory; the lower-case `mock:`
links use the resolved entry's ordinary or index base. Source-file links become
plain text and join the private source inventory, so direct HTTP requests
cannot expose them. Copyable resources remain byte-exact and join source watching.
Targets already public under the output root stay public and render as text.
Proven Mokly-owned output and metadata are rejected before inventory. Copied
resources retain their lexical public-name rules, including hidden and private
directory names. Authored closure files use the separate shared public policy. Filesystem failures never expose absolute paths.
`resource_paths.ts` reconstructs their public paths from manifest metadata so
compilation can validate copies before whole-tree replacement.

Destination classification uses the shared privacy policy. Package-root equality
is checked only by export capture; it does not reject Build or Serve.

The graph retains documents and asset bytes for demand rendering and worker
replay. Build applies the same generated-tree, final-link, resource
and transactional checks as pages. Manifest v9 records source resources; public
catalogue v5 exposes documents without source bytes. Changes compares rendered
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
