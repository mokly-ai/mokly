# Render graph modules

The [crate README](./README.md) describes the public entry points and usage.

- [`src/background.rs`](./src/background.rs) defines `BackgroundRead`, a hit
  that its worker finished or a `BackgroundMiss`, the single-use continuation
  of a miss, and `BackgroundWorker`, the lookup that `RenderWorkers::background`
  runs. Its `Completion` is the completion place and dispatch release of a miss
  with a prepared root. `Completion::handoff`, the only way into the completion
  place, receives the byte charge of that root.
- [`src/background_render.rs`](./src/background_render.rs) runs the lookup of
  one Serve background view on the render workers. Its private miss keeps the
  store key, the root eligibility, and the view's span, and no tree.
  `BackgroundMiss::complete` can prepare the own root, hands it off, and
  finishes the view on the render workers without a second lookup. A
  background finish of a view with a viewport keeps the walk record of the
  view. A page or a Markdown document keeps none.
- [`src/fragment_weight.rs`](./src/fragment_weight.rs) computes the capacity
  charge of a prepared root fragment without JSON encoding.
- [`src/document_codec.rs`](./src/document_codec.rs) defines `EncodedView`,
  the lossless compact document that the compact tier and the comparison
  capture share. Its `encode_identified` and `comparison_identity` hash the
  complete codec input. The private `document_identity` and
  `document_metadata` modules hold that hash and the retained metadata.
- [`src/document_store.rs`](./src/document_store.rs) defines `DocumentStore`,
  the optional render store boundary, with `Persistence`, `StoreKey`,
  `ReadOutcome`, `OfferOutcome`, `EntryFault`, and `StoreStats`.
  [`src/session_persistence.rs`](./src/session_persistence.rs) builds the
  `StoreKey` of a route and offers a fresh document after its checks.
  [`src/session_lookup.rs`](./src/session_lookup.rs) holds `Session::raw_lookup`,
  the one counted cache read and store load of every view, and
  `Session::compose_miss`, which composes a miss without a second lookup. The
  shared `Session::finish_artifact` of
  [`src/session_render.rs`](./src/session_render.rs) checks and inserts every
  document and offers each fresh one.
- [`src/write_activity.rs`](./src/write_activity.rs) defines `WriteReadiness`,
  `WriteActivity`, and `WriteLease`, the boundary that pauses the writer while
  Serve is busy.
- [`src/store_memory.rs`](./src/store_memory.rs) defines `StoreMemory`, the
  known buffer capacities and the separate charges of the writer.
- [`src/cache_export.rs`](./src/cache_export.rs) defines `EncodedConsumer` and
  `CacheOperation`, the writer work that `RenderCache::with_encoded` and
  `RenderCache::with_workspace` run inside the transit headroom.
  [`src/export_memory.rs`](./src/export_memory.rs) defines `ExportObserver` and
  `ExportBuffer`, which observe the scratch buffers of an export.
- [`src/document_persistence.rs`](./src/document_persistence.rs) and
  [`src/document_store_metadata.rs`](./src/document_store_metadata.rs) write
  the bounded stored record of a document into a fixed buffer through
  `EncodedView::write_stored` and restore it through `EncodedView::from_stored`.
  The private `document_export`, `document_capacity`, and
  `document_node_capacity` modules measure the visible scratch capacities of an
  export.
- [`src/workers.rs`](./src/workers.rs) defines `RenderWorkers` and
  `ThreadWorkers`, the injected worker pool, and `ComparisonTask`, one indexed
  job. Its `stylesheets` method runs one `StylesheetWorker` job for
  each stylesheet root, keeps the root order, and returns the first failure in
  root order. Its `comparison_tasks` method runs every index of a
  `ComparisonTask` once and returns when all of them have run. Its
  `comparison_stream` method runs a `ComparisonTask` as an ordered stream, with
  at most twice the pool size started and not yet consumed. Its `background`
  method runs one `BackgroundWorker` lookup on the pool. Its `capture_window`
  method runs a bounded capture window and joins every admitted task before it
  returns. Its `capture_parallelism` method gives the window limit, which
  includes the sidecar bound of the runtime.
- [`src/capture_window.rs`](./src/capture_window.rs) defines `CaptureConsumer`,
  which admits each route index of a capture window and frees the slot of a
  finished view only when its queued bytes fit.
- [`src/render_class.rs`](./src/render_class.rs) defines `RenderClass`, the
  scheduling class of a blocking render, `Foreground` by default.
  `RenderClass::in_scope` sets a class for one operation and restores the
  earlier class. `RenderClass::current` reads it. The private `WorkerContext`
  captures it with the tracing span for each worker job.
- [`src/fragments.rs`](./src/fragments.rs) defines `MemoFragments`, which
  memoizes JavaScript fragments in the same bounded cache. Its
  `record_served` forwards a store-served request to its renderer without a
  memo lookup.
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
- [`src/public_inputs.rs`](./src/public_inputs.rs) defines `ClosureInputs`,
  the leased closure-file records shared by equal document keys across
  generations.
- [`src/policy.rs`](./src/policy.rs) and [`src/closure.rs`](./src/closure.rs)
  define `FilePolicy` and `Walker`, the public-file policy and the referenced
  closure walk.
- [`src/viewer_fonts.rs`](./src/viewer_fonts.rs) defines `ViewerFonts` and
  `face`, the one target outside `static/` that a walk accepts: a viewer face
  named by a Markdown document's own stylesheet.
- `ClosureBuilder::collect_recorded` reports each input of the walk to a
  `ValidationRecorder`. Its default marks the walk unknown, so a builder that
  cannot record its inputs keeps no facts. The private
  [`src/closure_walk.rs`](./src/closure_walk.rs) holds the one walk that
  `Walker::collect` and `Walker::collect_recorded` run.
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
- [`src/reference_index.rs`](./src/reference_index.rs) defines
  `ReferenceIndex` and `MemoryReferenceIndex`, the reference edges of each
  referenced file of one generation and its reads of the style memo.
- [`src/collection.rs`](./src/collection.rs) defines `ComparisonCollector`,
  which consumes encoded comparison inputs in route order. Its `encoder`
  method gives the encoder that the workers use, and its `remaining` method
  gives the capture bytes that waiting views can use.
- [`src/collection_input.rs`](./src/collection_input.rs) defines
  `ComparisonEncoder`, the encoding boundary that a collector or a checking
  wrapper supplies. It returns the encoded view and its codec identity.
  `EncodedComparisonDocument` holds one encoded view, its identity, and its
  closure while the view waits for its turn.
- [`src/prefetch.rs`](./src/prefetch.rs) defines `PrefetchGuard`, which stops
  the early renders of one classification and waits for them when it drops.
- [`src/comparison_input.rs`](./src/comparison_input.rs) defines
  `RetainedComparisonInput` and `ComparisonFallback`, a retained comparison
  input and the deferred source read of a failed restore, and
  `RetainedDocumentEvidence`, the codec identity and closure of a retained
  view.
- [`src/comparison_stream.rs`](./src/comparison_stream.rs) defines
  `ComparisonConsumer`, which admits each index of an ordered comparison
  stream and consumes the finished indexes in order.
- [`src/comparison_proof.rs`](./src/comparison_proof.rs) defines
  `ComparisonRead`, `ProofMode`, `ContentIdentity`, and `DocumentProof`, the
  content proofs of comparison reads.
  [`src/session_proof.rs`](./src/session_proof.rs) answers them for a
  prepared generation.
- [`src/source_snapshot.rs`](./src/source_snapshot.rs) defines
  `SourceSnapshot`, the generation-scoped source reader.
- [`src/asset_delivery.rs`](./src/asset_delivery.rs) defines `AssetRead`, the
  digest-checked opaque asset stream.
- [`src/error.rs`](./src/error.rs) defines `GraphError`, which keeps the
  failure of each subsystem.
