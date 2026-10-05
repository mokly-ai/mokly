# Historical catalogue comparisons

## Delivery Status

Removal of baseline compatibility below is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Uniform CSS classification and evidence fields below are implemented in Milestone 19;
comparison details are implemented in Milestones 20 and 20B of the
[source-path removal plan](../../plans/remove-source-path-evidence.md).

Milestone 4 removed source-path comparison evidence. Milestone 23 removed
historical marker translation. Milestone 28 uses recorded inserted-link
spans inside Review-ignore for both comparison paths and the CSS rule scope.
Milestone 29 will remove the unused one-sided `page` material used by
`component_view.ts`, while keeping its range/span validation and resource work.

## Scope

This internal module compares current validated output with a historical
baseline. The supported consumer interface remains the catalogue and CLI;
these modules are not public package exports.

Unrendered source edits do not change catalogue membership or evidence.
Rendered `styles` and non-CSS `resources` records retain ownership attribution.
Stylesheet changes use kept own-page matches and outside/unresolved page evidence;
no CSS owner record routes them.
Only canonical, valid manifest v8 input reaches comparison. Every
catalogue uses the same public comparison v5 format.
Baseline and current documents use the same marker grammar. Former-spelling
comments and script text stay ordinary content; comparison never renames them.
Missing recorded ranges fail normal validation: Serve keeps Browse usable with Changes
unavailable, while explicit export and publish captures fail safely under the
[invalid-baseline contract](../../docs/protocol/mokly-baseline-compatibility.md#invalid-or-missing-data).
Component-aware page comparison excludes only proven Mokly-inserted declared
stylesheet links, except a component page's root-owned links. It uses private
final-document spans on both complete and unchanged-view fast paths; actual
resource and CSS analysis still reads the final linked document.
`component_stylesheet_resources.ts` reads inserted links from validated original
spans and checks their recorded public paths. These paths supplement normalized
author resource references on both comparison paths and in the CSS rule scope.
CSS imports and referenced assets follow the usual graph.
`artifact_stylesheets.ts` carries the same private spans from complete and
selected captures to publication validation. It adds no public output field. Matching still uses
the normalized document, so ignored author markup, links and inline styles stay
ignored. Renderer links reused for declarations remain page content.
`component_projection_resources.ts` prepares paired and one-sided
comparison-only copies,
while `component_view.ts` and `component_view_fast_path.ts` preserve the full
documents for actual resource closure and CSS rule evidence. See the
[stylesheet ownership contract](../../docs/protocol/mokly-component-stylesheet-ownership.md).

`git.ts` defines separate `RepositoryEvidence` (merge base and changed paths)
and `BaselineReader` (historical files) interfaces. Paths at the reader boundary
are repository-relative and reads identify their commit. `ReadOnlyReviewRepository` in `repository.ts`
groups those independent dependencies for comparison orchestration.
`CommittedRepository` composes `GitRepositoryEvidence` with
`CommittedBaselineReader` using an injected `GitCommandRunner`.

Production composition uses `ConfiguredGitCommandRunner` from `config/git.ts`.
Its first read calls `requireGitTopLevel`, sharing validation across concurrent
reads and retaining `config-invalid` for a nested `repoRoot`. Preparation also
validates when handed an already resolved commit. Build and committed Check
never construct this boundary; Serve can keep All available while an explicit
comparison reports the configuration error. The worker's Git host is only a
transport: the classification worker validates its configured runner before
requesting repository evidence.

`git_batch.ts` bounds literal tree queries and blob reads by pathspec bytes,
object count and output bytes. `assets.ts` applies the baseline manifest's
source inventory and the active config’s public exclusions relative to the baseline
mockups root. Historical reads reject non-regular files and do not resolve aliases
through the current filesystem.
`compare.ts` builds complete comparisons; `selected.ts` retains only a requested
view's checked snapshot closure. Neither reader executes historical code.
`page_preview.ts` captures one page selected from an accepted removed-entry
snapshot. Its caller supplies the pinned `BaselineReader`; the provider verifies
the page against that snapshot's baseline manifest, then reuses
`GitReviewAssetReader`, `SelectedAssetReader` and `copySnapshotDependencies` for
the same confinement, source exclusions, regular-file checks, transitive
resource traversal and 64 MiB bound as screen panes. It returns typed
`RemovedPagePreview` metadata plus the baseline files; the artifact renderer adds
strictly validated `preview.json` without creating page records in `review.json`.
Current and baseline manifests require the same v8 shape under the
[baseline compatibility contract](../../docs/protocol/mokly-baseline-compatibility.md).

Lower integer manifest versions and former-name sentinels give the existing
typed unavailable outcome. Former files are never read. Invalid v8 data stays
invalid, including earlier branch output with missing roots or provenance or
stored CSS owners. Panes keep identity-derived paths and unchanged HTML; there
is no schema, stored-layout or URL-rewriting fallback.

Server classification and export use the same interfaces. Export pins only
repository evidence and retains the same baseline reader, including its optional
bulk-read capability. Current output and public assets have separate readers.

`prepare.ts` is the asynchronous composition boundary for CLI/export,
publication and the Serve parent. `prepareReviewRepository(config, base,
{ signal, onProgress })` resolves one commit, awaits a derived rebuild when
configured, and returns a branded `PreparedReviewRepository`: pinned `commit`,
`evidence`, `reader`, completion `marker` (undefined in committed mode), and
`assertUnchanged()` for the publication recheck. Only that factory constructs
the prepared type.

`repository.ts` contains read-only factories and has no import path to the
builder. `baselineReaderForCommit` and `readOnlyRepositoryForCommit` open an
already prepared commit without rebuilding; `committedReviewRepository` can
construct Git readers locally and rejects derived mode. Comparison and
classification functions require an injected `ReadOnlyReviewRepository` and
never prepare one implicitly. Serve hands its child the prepared commit in a
versioned update; `ServedReviewRepository` swaps or revokes the child reader.
Before preparation, an unselected comparison fails with `review-invalid`.

`head_assets.ts` keeps derived generated bytes in memory and confines disk reads
to authored public resources. Background evidence retains `headOutputs` as
serializable `[route, content]` pairs (strings for documents, tagged base64 for
binary files), alongside its digests, so selected diffs use the accepted
compilation across worker and child-process boundaries without decoding assets.
Derived classification compares all generated documents and reachable resource
bytes even without changed Git output paths. Cache paths and their physical
aliases are excluded before rendered-resource classification.
The classifier records retained view resources, per-rule unfiltered and kept
own-page CSS proof, page selectors and non-CSS actual-invocation owner reasons by entry pair. Source validation accepts dependency reasons only from
that record; it never trusts result view records as sources or re-evaluates a
source-path policy. The record uses kind and id, including flattened variants.

```bash
npm run build
node --import tsx --test tests/review*.test.ts tests/server_changed.test.ts
```

See the [Changes contract](../../docs/protocol/mokly-changes.md),
[derived baselines contract](../../docs/protocol/mokly-derived-baselines.md),
and [export boundary](../export/README.md).

## CSS rule attribution

`css/` provides parsing, diffing, and document matching for
[CSS change attribution](../../docs/protocol/mokly-css-attribution.md).
Review v5, live membership, watched updates and publishing use it to
exclude changed stylesheets whose changed rules cannot match a view. Public
resource globs cannot bypass the graph or restore excluded stylesheets. These
review interfaces are internal; the package authoring API is unchanged.

The [rule membership contract](../../docs/protocol/mokly-css-attribution-rules.md)
applies to configured, declared, CSS-imported and JavaScript-bundled stylesheets.
Retain all before/after matches after paired Review-ignore, with their component
containment. Match equal normalized before/after rule tuples across files.
Collect unfiltered own-page matches for every component and rule. X loses an
own-page match inside a different nested Y if Y's unfiltered own-page set is
nonempty. Self-nested X cannot take its own match. Only kept matches change X
and its matching saved variants. Y need not be changed, so this calculation is
independent of order and works with recursive or mutually nested components.
Root output markers keep renderer wrappers separate from component output.

Page rows still use inclusive nested containment. A page gets its own reason
for matches outside components changed by that same rule, or for unresolved rules. A wrapper-only component page reason gives its
saved entry a row, but adds no affected consumers. Resource ownership cannot
filter CSS or turn an invocation match into a component change. Declared links
keep `insertedStylesheets` provenance, without derived `resources` records.
The [evidence schema](../../docs/protocol/mokly-css-attribution-membership.md)
defines the in-place v5/v4/v8 updates and complete/fast/selected agreement.

Review result v5 replaces both earlier result versions; a catalogue without
registered components emits the same shape with empty component arrays.

`analysisOwnsStylesheet` owns the shared public-output boundary. Source/token
stylesheets outside it are not evidence unless their rendered output changes.
`imported_changes.ts` compares accepted generated CSS and binary asset bytes
against the pinned branch-point reader, even when Git ignores derived output.
It merges changed generated routes with Git's authored paths. Only rendered
documents, reachable resources and reviewable metadata can produce evidence;
private CSS, transformer-only inputs and PostCSS candidates do not add
source-path evidence. A baseline predating generated CSS produces a one-time
change for linked views. Review result v5 and live Changes use the same byte
comparison and accepted input set.
Accepted generations carry their stylesheet/asset route index, output bytes
when available, and delivered sources through the runtime and background
worker. Committed classification never reloads the graph or reruns PostCSS;
classification without an accepted generation performs one inventory load.
After comparing views, both producers call `assertViewAnalysisScope` to reject
analysed reasons outside that boundary with `review-invalid`. The shared decoder
checks stylesheet identity; only producers have the resolved scope configuration.

```ts
import { diffCssRules } from "./css/diff.js";
import { LightningCssRuleParser } from "./css/rules.js";

const result = diffCssRules(
  ".button { color: red; }",
  ".button { color: blue; }",
  new LightningCssRuleParser(),
);
if (result.status === "resolved") {
  // result.changed retains the before and after rules, ordered by after ordinal.
  console.log(result.changed);
} else {
  console.log(result.failures);
}
```

Depend on `CssRuleParser.parse(stylesheet: string): CssRuleParseResult` for
injection. Tests can return typed fixtures without invoking a native parser.
Parsing and diffing return typed unresolved results instead of throwing failures.
Duplicate rules are counted, exact matches are cancelled before edited rules are
paired, and moving an identical rule produces no change. Conditions stay in their
outermost-first order and are never evaluated. Selector-less at-rules retain their
name, prelude, and complete body for conservative treatment by the matcher.

Lightning CSS's normal optimizer merges declarations and separates important
declarations from ordinary declarations. `source.ts` recovers the original runs;
`serialization.ts` removes trivia while preserving declaration order and strings.
Native header serialization omits nullable optional AST fields when returning them
to Lightning CSS, whose visitor decoder expects those fields to be absent.
The parser requires Lightning CSS's optional native package for the host platform;
the installed Node package has no automatic WASM fallback. `lightning.ts` loads
that CommonJS native boundary directly so an ESM process does not pre-parse its
exports before using the parser.
Comments between identifiers and opening parentheses retain token separation,
so an invalid function spelling cannot cancel a valid function in a rule diff.

For one stylesheet and view, call the shared reduction entry point:

```ts
import { parse } from "parse5";

import { analyzeStylesheetChange } from "./css/analyze.js";

const outcome = analyzeStylesheetChange(
  ".button { color: red; }",
  ".button { color: blue; }",
  { after: parse('<!doctype html><button class="button">Save</button>') },
);
// A kept outcome also retains each rule delta and all matched elements.
```

Pass the already-normalized before/after parse5 documents; either side may be
absent for added/removed views. An absent stylesheet is passed as an empty string.
`matchCssRules(diff, documents)` retains a decision for each diffed rule;
`analyzeStylesheetChange` composes the parser, diff, and match, returning one
`CssAnalysisOutcome`. The optional fourth argument injects a `CssRuleParser`.
The optional fifth argument injects `matchCssRules` for boundary tests;
`CssResourceAnalysis` accepts the same matcher as its second constructor argument.
Selectors are the kept rules' original serialized selectors, sorted and unique;
an unresolved rule takes precedence over matched rules in the reduction.

The closed keep-list, in contract order, marks these constructs `unresolved`:

- Selectors the matcher cannot parse.
- Shadow selectors: `:host`, `:host()`, `:host-context()`, `::part()` and `::slotted()`.
- Universal, `:root`, `html` and `body` selectors, including selector arguments
  and nesting parents, but excluding literal attribute values and synthetic
  universals introduced by state stripping.
- Nesting parents whose combined selectors cannot be resolved.
- Changed custom-property declarations (`--*`), including removals.
- Selector-less at-rules, including `@font-face`, `@keyframes`, `@property`,
  `@counter-style` and `@page`.
- Changed `@import` or `url()` references, including URLs in condition preludes.
- A stylesheet parse failure on either side; no partial selectors are retained.

Ordinary rules are `matched` when either document matches and `excluded`
otherwise. An unchanged custom property or URL within an edited rule does not
itself trigger unresolved evidence. Matching is potential impact, never proof
of a visible change. A formatting-only diff has no changed rules and is excluded.

Nested parents are combined through `:is()` for matching. Interactive states and
pseudo-elements use the base compound, with negation handled conservatively;
media/container/supports/layer conditions stay unevaluated. The parse5 adapter
preserves inert template boundaries, document quirks, and foreign-element name
case. `css-what`, also used by `css-select`, is a direct dependency so selector
rewrites use its typed syntax tree rather than string or regular-expression
substitution of pseudo-selectors. No direct domhandler/domutils dependency is
needed. HTML resource discovery uses the same source tokenizer for CSS URLs and
imports, preserving comment markers inside URL values. Discovery retains valid
references before incomplete syntax; strict rule parsing still reports it unresolved.

`ResourceComparison.compare(before?, after?, excluded?, matching?)` reads and
validates resource closures before passing changed resources to
`CssResourceAnalysis.analyze(resources, documents)`. CSS uses actual normalized
resource reachability and markup, without owner-based exclusions. Non-CSS
resource ownership retains its separate projection policy. Embedded
documents also supply matching trees. Base resource reads are batched by graph
depth; optional counterpart CSS reads distinguish missing files from invalid
ones. Per-side readers cache bytes, and the injected parser caches identical CSS
text for the run. Live resource validation additionally retains its alias and
verified-deletion behavior. `deleted_resource.ts` owns that one decision for
both unified and screen-level classification, including derived byte comparison
and paired embedded-document normalization; each caller still supplies its
confinement-aware current and baseline readers.
Committed live classification batches base documents for changed or moved documents and
for views with changed stylesheet resources. Only an unchanged, unmoved view
without changed CSS skips base view reads and base graph traversal, so verified
deletions of non-stylesheet resources are still discovered from the before side. Current resource validation still checks Git
counterparts for verified deletions and pairs embedded documents' ignored regions.
Changed documents retain discovery of resources removed from their before side.
Derived classification reads every baseline view from its prepared reader. It
applies rule attribution to stylesheets with Git change evidence and preserves
material resource-byte changes without inventing dependency paths.
Unexpected parser or matcher failures keep only the failing resource
unresolved, with any recoverable changed selectors, and classification continues.

Review v5 retains `material: true` exactly when the actual paired,
ignore-normalized documents differ, including added and removed views. Ownership
projections do not define this flag. A material change keeps the ordinary screen
heading even when stylesheet evidence is also present. The result retains
optional view `reasons` (with stylesheet `analysis`) and `excludedResources`.
Entry reasons merge by path and rule identity. They union page selectors
separately from all selectors, with unresolved evidence taking precedence. The shared browser/server decoder rejects
invalid or contradictory evidence; canonical artifact serialization preserves it.
Owned non-CSS resources retained at an actual invocation keep their component
in Changes even when saved variants exclude them. CSS requires kept matches on the
component's own pages; consumer-only matches cannot grant a component reason. Unrendered entry declarations never provide
independent evidence, even for CSS.
The screen-only live classifier retains a `ScreenResourceEvidence` slice from
the same traversal that determines membership. The shell receives its selected
`ViewResourceEvidence` records without requesting snapshots or component
classification. Export projects the same slice from its v5 result;
both producers omit empty views and screens left without evidence. The inspector
merges it with loaded comparison details. The public result schema is v5; every catalogue uses the same
rendered-resource policy.

With `--debug-timings`, `review.css-analysis` measures each stylesheet/view's
parse-cache lookup or parse, rule diff, selector matching and reduction. It
excludes resource reads and preparation of the input document trees. Cache hits
still run diffing and matching. Compare its interval union with the enclosing
background `changes.classify` duration in the same session; do not sum parent
and child spans. See the [timing contract](../../docs/protocol/mokly-timings.md).

`component_classification_comparisons.ts` collects all view comparisons before
`css/attribution.ts` freezes own-page proof. It keeps unfiltered matches for
nested filtering and kept matches for component reasons. `css/identity.ts`
checks both the SHA-256 key and its normalized tuple. `css/normalized_ranges.ts`
rebases root proof through paired ignore, including a removed root marker.
`css/resource_scope.ts` keeps each embedded document's stylesheet scope separate.
Live screen-only content checks reuse the completed CSS evidence and keep their
existing non-CSS alias policy. Selected results never repeat rule analysis.

## Development

```bash
node --import tsx --test tests/review_css_*.test.ts
npm run typecheck
cargo xtask check
```

Key code:

- `change_evidence.ts`, `imported_changes.ts`: freeze Git-authored paths merged
  with accepted generated stylesheet/asset bytes and delivered-source stripping;
  live, export and Changes-enabled publication use the same typed input for
  comparison and membership.
- `compare.ts`, `component_compare.ts`: the unified v5 comparison and retained
  artifacts for every catalogue.
- `page_preview.ts`: typed before-only page capture from accepted removal state.
- `artifact_files.ts` and the shared viewer-data builders: collision-checked
  writes plus snapshot and removed-page artifact naming from entry identity.
- `deleted_resource.ts`: shared verification and byte comparison for a
  currently referenced resource that may have been deleted.
- `component_variant_classification.ts`: flat component variant entry pairing,
  reasons, view evidence, and grouped v5 result records.
- `component_classification_sources.ts`, `component_classification_entries.ts`,
  `component_reason_sources.ts`, and `component_result_sources.ts`:
  source-complete v5 assembly, entry-view preparation, and validation.
- `component_classification.ts`, `component_view.ts`: component ownership policy.
  `compareComponentView` has two paths: an unchanged decision that settles a
  paired view only when marker-retaining documents, routes, and usage topology
  agree, followed by head resource discovery in committed mode or independent
  discovery for both sides in derived mode, and the complete comparison
  (projection, range validation, CSS analysis, implementation diffing) for
  views that can differ. Entry-owned props may differ on the fast path and
  invocation source metadata is ignored; every nested input or
  ownership-topology difference falls through. One-sided views
  validate the same current-spelling ranges on either side before normalization. Both paths
  produce identical records for valid builder output. Identical handcrafted
  malformed ownership markers are outside that equivalence guarantee because
  views without ownership text edits do not repeat range validation. Views with
  instances, styles, or entry-owned slots validate ranges while preparing their resource projection. The
  internal `useFastPath` classification input and trailing `compareReview`
  options object exist only for differential tests and default to enabled. The decision rule lives in the
  [component change attribution contract](../../docs/protocol/mokly-component-changes.md#unchanged-view-decision).
  Views with instances, styles, or entry-owned slots additionally run the same ownership projection
  and excluded-resource discovery as the complete comparison. This proves
  resources that HTML parsing may discard in contexts such as `template` or
  `select`, including siblings exposed when component implementation text is
  removed. Views without ownership text edits use actual-document evidence
  alone.
- `component_resource_attribution.ts`: non-CSS invocation ownership; its CSS
  promotion is removed under the planned rule contract.
- `assets.ts`, `component_resources.ts`, `resource_graph.ts`: confined reads and
  traversal shared by resource evidence and snapshots.
- `css/types.ts`: rule records, the parser interface, and result/error contracts.
- `css/rules.ts`: native parsing and ordered context-aware rule collection.
- `css/source.ts`, `css/serialization.ts`: source boundaries and normalization.
- `css/diff.ts`: deterministic multiset diffing with an injected parser.
- `css/analyze.ts`, `css/match.ts`, `css/match_types.ts`: view reduction, the
  ordered keep policy, per-rule decisions, and contained selector errors.
- `css/document.ts`, `css/document_query.ts`: default parse5 adapter and queries
  that retain HTML/SVG/MathML name semantics.
- `css/nesting.ts`, `css/pseudos.ts`: parent substitution and static match bounds.
- `css/material.ts`: changed custom-property and URL-reference detection.
- `css/paths.ts`: shared public stylesheet analysis scope.
- `../../packages/viewer/src/review/css/stylesheet_path.ts`: browser-safe,
  case-insensitive stylesheet identity shared with readers.
- `resource_comparison.ts`, `css/resource_analysis.ts`: shared resource evidence
  and the classification-scoped parser cache.
- `../../packages/viewer/src/review/result_resources.ts`: browser-safe
  validation of retained/excluded evidence shared with readers.
- `resource_documents.ts`: one paired normalization for embedded-document
  discovery and matching; normalized ignore tokens are never parsed a second time.
- `artifact_resources.ts`: validation of evidence against retained snapshot resources.

See the [Changes contract](../../docs/protocol/mokly-changes.md),
[component attribution contract](../../docs/protocol/mokly-component-changes.md),
and [component result schema](../../docs/protocol/mokly-component-review.md).
