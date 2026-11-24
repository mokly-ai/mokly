# mokly-graph rendering and documents

This page is part of the [`mokly-graph` README](./README.md). It holds the
rendering and document guidance of the crate. The first sections cover the
document plans, the document keys, and the render input keys. The last
sections cover the comparison collection and the early renders. The
[Key Code](#key-code) list names the entry points of these parts and of the
head validation.

## Document plans and keys

Preparation renders no document. Each plan carries a route and the document
node's input hash, which is the public `documentKey` of the
[rendering contract](../../docs/protocol/mokly-rendering.md). Stylesheet
dependency edits recompute their bundles. Equal emitted CSS and asset digests
preserve document keys. `dyn RenderGeneration` supports on-demand rendering, a
full build pass, resource reads, and closure queries. `render_props` validates
a complete transient props map with the parent's prepared validator from
`PreparedCatalogue::prop_validators`, and uses the same composition and
closure path.
Its document does not replace the saved plan or catalogue props. The
generation also exposes validated PostCSS directory watches, including empty
glob matches.

A JavaScript document key includes the render input keys of the definitions
that it renders, so an edit moves only the keys whose module closures it
reaches. Markdown document keys include no render input key.
Document keys include component paths and element names. Logical links depend
on their destination routes, including use-case first steps. An unresolved
link substitution inside a component depends on the routing inventory,
including when a prop reaches it through another component. One immutable
routing inventory serves each generation. Opaque entries share its complete
key. Explicit case spellings, moved aliases, and missing targets keep their
requested identities in the document key.

## Render input keys

`RenderKeys::build_reusing_with_workers` gives the same keys as
`RenderKeys::build` and keeps compact facts about the inputs of each key. With
earlier keys as `previous`, it copies an earlier key only when every input of
that key is equal, and it calculates the other keys. With `None`, or with
earlier keys whose facts are not complete, it calculates every key and keeps
the facts of the new keys. It never waits for a seed that has not finished.
The facts live as long as their keys and keep no module graph, catalogue,
earlier keys, or lease.

`RenderKeys::build_unseeded_with_workers` calculates every key like
`RenderKeys::build_with_workers` and adds an empty fact cell to the keys.
`RenderGeneration::prepare_render_reuse` seeds that cell once. It reads the
config and catalogue that the prepared generation already holds, and it keeps
no copy of them. It changes no key and runs no key job. It does nothing when
the keys of the generation have no empty cell. Serve calls it after the
Changes of that generation complete as Ready or Unavailable.

`RenderKeys::build` and `RenderKeys::build_with_workers` keep no facts and no
cell. `RenderKeys::reuse_facts_bytes` reports the size of the cell, which
holds the facts value, and the capacities of the vectors and strings of its
facts. It leaves out allocator headers and the key map. It is zero for keys
without a cell. The `render.inputs` span records the `reused` key count and
that size as `retained_bytes`. The seed records that size in its own timing
stage, so a seed never appears as a key calculation.

## Comparison collection

`collect_comparison` streams complete side validation to an ordered
`ComparisonCollector`. Each view composes once, including when the artifact
cache retains nothing. The build head capture and the base capture use this
validation path. It renders the views through
`RenderGeneration::schedule_capture_window`, in the sliding window of the
[capture rules](../../docs/protocol/mokly-comparison-serving.md#base-and-head-capture).
That method runs `RenderWorkers::capture_window` on the generation's render
workers, with the limit from `RenderGeneration::capture_parallelism`. This
crate owns the window and the hand-off in route order. A worker encodes
each finished view with the `ComparisonEncoder` from
`ComparisonCollector::encoder`, and then it releases the decoded input. The
result is an `EncodedComparisonDocument`. The collector in `mokly-compare` owns
the capture bound, and `ComparisonCollector::remaining` gives the bytes that
the bound has left. Encoded views that wait for their turn share those bytes.
The window's `CaptureConsumer` frees the slot of a finished view only when the
view fits them, so a view that does not fit keeps its place until its turn. A
waiting view never changes which earlier views the collector keeps. Validation
keeps only cross-view facts, and it records them, the warnings, and the
aggregate failures at each view's turn. Inputs stay provisional until the final
anchor and output-name checks succeed. Apart from the capture bound, the window
holds at most one transient input or finished view for each render worker.

## Early renders

`RenderGeneration::uncached_documents` lists the routes whose document keys no
cache tier or prepared render-store index holds. Its store probe uses the full
native and JavaScript build identity and restores no document. `RenderGeneration::prefetch_comparison` starts their early
renders on the workers of the capture window, and it returns a `PrefetchGuard`.
Each early render enters the render cache. A capture read of the same route waits for an
early render that still runs, and it takes over one that has not started. When
the guard drops, it stops new early renders and waits for every running one.

## Key Code

- [`src/render_inputs.rs`](./src/render_inputs.rs) defines `RenderInputs` and
  `RenderKeys`, the render input key of each entry module over its module
  closure, resolution files, bindings, and bundle environment.
  `RenderKeys::build_with_workers` calculates the same keys as
  `RenderKeys::build` on injected `RenderWorkers`.
  `RenderKeys::build_unseeded_with_workers` also adds an empty fact cell for a
  later seed. `RenderKeys::build_reusing_with_workers` keeps reuse facts and
  copies each unchanged key from the `previous` keys.
  `RenderKeys::reuse_facts_bytes` reports the bytes of the cell and its facts.
  The private `render_preparation` module encodes the records of every builder,
  and the private `render_reuse` module compares the facts and finds the keys
  to calculate again.
- [`src/collection.rs`](./src/collection.rs) defines `ComparisonCollector`,
  which consumes encoded comparison inputs in route order. Its `encoder`
  method gives the encoder that the workers use, and its `remaining` method
  gives the capture bytes that waiting views can use.
- [`src/collection_input.rs`](./src/collection_input.rs) defines
  `ComparisonEncoder`, the encoding boundary that a collector or a checking
  wrapper supplies. It returns the encoded view and its codec identity.
  `EncodedComparisonDocument` holds one encoded view, its identity, and its
  closure while the view waits for its turn.
- [`src/capture_window.rs`](./src/capture_window.rs) defines `CaptureConsumer`,
  which admits each route index of a capture window and frees the slot of a
  finished view only when its queued bytes fit.
- [`src/prefetch.rs`](./src/prefetch.rs) defines `PrefetchGuard`, which stops
  the early renders of one classification and waits for them when it drops.
- [`src/head_validation.rs`](./src/head_validation.rs) defines
  `HeadValidation`, `HeadProof`, `ClosureProof`, `ClosureFacts`,
  `DocumentChecks`, `ValidationRecorder`, and `ValidationRead`.
  `RenderGeneration::validate_head` runs complete head validation over every
  view with a caller's `HeadValidation`. `HeadValidation::kept` can prove a
  view from the caller's kept facts with no document read. For any other view
  the caller supplies the checked document, and either proven closure facts,
  the background walk of the same generation, or a recorded walk.
  `HeadValidation::validated` lets the caller keep the outputs of a view read
  from its document. The default calls `render_all`.
  `RenderGeneration::validation_document` and
  `RenderGeneration::validation_identity` give the checked head read and the
  proof of one walk or link input. `RenderGeneration::validation_checks`
  exports the checks of a checked read, and
  `RenderGeneration::adopt_validation` adopts them for a proven document
  instead of a read. Their defaults read `comparison_document`, prove nothing,
  export nothing, and decline. The caller's `HeadValidation` reads documents
  and inputs through the outermost generation. So a checking wrapper can
  forward `validate_head`, and it keeps its checks in these four methods. The
  private [`src/session_head.rs`](./src/session_head.rs) runs the pass for a
  prepared generation. A view proven from kept facts replays their observer
  calls and takes its anchors, links, and warnings from them. Its adoption
  reads the render cache once, as the checked read's lookup does, and a
  document that the cache does not hold takes the checked read. Any other view
  takes its anchors, links, and document warnings from its current document.
  Every ordered and global check still runs over all views. The private
  [`src/head_links.rs`](./src/head_links.rs) answers the `LinkTarget` read:
  the destination, a use case's first screen, and the route and document key
  of each view that the link check of one target reads.
- [`src/head_walks.rs`](./src/head_walks.rs) defines `WalkRecord` and
  `WalkStep`. A Serve background read records the read set of its closure walk
  through the same recorder calls as a validation walk. The generation keeps
  one record for each view with a viewport that its background reads walked,
  within two MiB, and its head validation takes each record once. A page or a
  Markdown document keeps no record, because the pass reads it again after
  each edit, also when its document did not change. A record ends with that
  validation or with its generation.
