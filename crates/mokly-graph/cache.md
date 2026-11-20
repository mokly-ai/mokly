# mokly-graph cache and retained comparison

This page is part of the [`mokly-graph` README](./README.md). It holds the
cache and retained comparison guidance of the crate. The first sections cover
the dependency records, the render cache, the render store, and the link index
and result store. The last sections cover the document codec, the captures and
retained inputs, the content proofs, and the source snapshots.

## Dependency records

Resources found during composition enter a leased dependency index. Each
recipe retains its first observed digests. Later preparations add changed
resource digests to its key. Usage completion alone keeps the published key.
A resource edit changes its consuming document keys and reuses JavaScript
fragments. Missing and denied lexical resource paths stay observable for
repair. Weak subscribers attach those paths before the background pass
completes. Key scans read template bodies and saved slots as authored HTML, so
unknown ignore-wrapper attributes do not enter document keys.
`generation_key` hashes the configuration, the document plans, the delivered
stylesheet and asset identities, and the fragment generation for the live
descriptor. A private stylesheet input that changes no delivered byte keeps it.
`public_files` reads the shared closure records of the generation's document
keys and applies its own policy to each path. An unchanged document's render
that completes after replacement preparation is visible to the replacement.
The records index both document keys and public paths. A membership request
looks up one path and tests only the keys that reached it. The last lease of
a document key removes its records from both indexes. Serve also rechecks
live eligibility at read time. Temporary closure membership stays separate
from the catalogue's reached public files.

## Render cache

`MemoryCache` implements `dyn RenderCache` with a full tier and a compact tier
under one total byte bound. `MemoryCache::new` takes that total and the ceiling
of the compact tier. One sixteenth of the total is fixed headroom for documents
in transit and their encoding workspace. The full and compact tiers share the
rest. Each tier evicts by access order. The full tier charges document bytes,
parsed trees, and evidence, including registry ownership in documents and fragments. The charge
is an estimate of retained memory. Usage, instance, and slot records count at
twice their JSON length. When the full tier evicts a document, the cache
reserves its charge plus twice that charge for encoding from the headroom.
The same locked step takes one of eight reusable encoder leases. Each encoder
allocates on first use and keeps a 384 KiB headroom charge while idle or active,
up to 3 MiB for all eight. The encoder reuses its compressor and serialization
buffers between documents. If the document and workspace charges do not fit,
or no lease is free, the document leaves the cache and counts as an eviction.
Inserts never wait. A reservation handle releases the document charge and
returns the lease on every exit path, including encoding failure. Encoding runs outside the lock. Its
completion transfers the document from transit to the compact tier in one
locked step. The compact tier uses room from evicted full entries up to its
ceiling. Every other evicted artifact leaves the cache. A lookup reads the full
tier, then transit documents, then the compact tier. A transit hit returns the
full artifact without a restore. A compact hit returns the restored artifact.
It promotes the entry to the full tier only
when the same key was restored before within fewer cache operations than the
full tier has entries. An `insert` of a key that transit or the compact tier
holds keeps the entry there, so a caller that stores a restored artifact again
does not promote it. When the full tier already holds the same artifact handle,
and a replacement would keep the same charge, an `insert` only refreshes its
access order. It computes no new charge, and it still counts as a cache
operation. A failed restore removes the entry, counts as a miss and as a
restore failure, and logs an error without document data. `stats` reports the
charged bytes of both tiers, transit, and encoder leases, retained artifact
entries, and the hit,
restore, restore failure, miss, and eviction counts of the
[`render.cache` record](../../docs/protocol/mokly-timings.md#core-spans).
Oversized artifacts return to the caller without retention. Plans keep
recipes rather than a complete set of parsed documents.
Eviction changes work only. Cross-view anchor checks retain successful
destination renders in this same bounded cache. A repeated check of one
destination view and fragment uses the stored result of the generation when it
has one, and reads no document. Concurrent checks of one destination share its
active render.

## Render store

`DocumentStore` is the optional render store boundary.
`DeliveryInputs::persistence` carries one `Persistence`: the store and the
JavaScript identity of the generation. Serve sets it for its head and base
graphs, and direct and one-shot callers leave it absent. `StoreKey::new`
combines a document key with the build identity: the native identity of the
store and, for a document that uses JavaScript, the JavaScript identity. When
a part is absent, the generation neither reads nor offers that document. After
a render cache miss, a generation reads the store before it renders. A stored
read repeats the public closure walk, the link checks, and the usage records of
its side, so it gives the result of a fresh render. On a usable store hit, the
generation also passes the same `ComposeRequest` that a composition uses to
`Composer::record_served`, which records the root JavaScript request for the
return warm-up. A render cache hit records nothing. A fresh document is offered
only after the checks of its side pass, and a comparison collection offers its
documents only after the whole collection passes. No generation waits for the
write. Serve calls `DocumentStore::resume` after each completed Changes result,
so the store writes nothing before the first one. `RenderCache::with_encoded`
lends a writer one encoded document without a promotion, a refresh, or a count.
It charges three times the document charge to the transit headroom, and it
takes an encoder lease only for a document that is not compact yet.
`RenderCache::with_workspace` charges the writer's fixed segment buffer to the
same headroom. So the render cache stays the one owner of document memory.
`EncodedView::write_stored` writes the bounded private record of a document,
with all of its metadata, into a fixed caller buffer, and
`EncodedView::from_stored` restores it. Serve work holds a `WriteLease` of the
writer's `WriteActivity` while it runs, and `WriteReadiness` tells the writer
whether the current Changes result is ready or unavailable. `StoreStats::memory`
carries the writer's `StoreMemory`, and an `ExportObserver` samples export
scratch without changing the cache accounting. The
[render store contract](../../docs/protocol/mokly-render-store.md) owns the
identity, the faults, the bound, and the writer rules.

## Link index and result store

Each generation builds one immutable link index when it is created, and drops
it with the generation. The index holds two positions for each catalogue entry
and nothing else, so it copies no plan, route, or document. It finds the
destination views of a logical link in route order without a scan of every
plan. Its memory is outside the bound of the result store.

Each generation also keeps one result store with the presence of each checked
fragment in each destination view. Its records, their fragment bytes, and its
bookkeeping count against a fixed 2 MiB bound. A result that does not fit is
not kept, so the next check of that view and fragment reads the destination
again. Growth can briefly hold one more copy of the record slice, so the peak
stays within 4 MiB before allocator overhead. A new generation starts with an
empty store, and complete validation records the presence that it finds in
each destination view that it checks. A stored result holds no error, so each
failure names the referring route of the current check and the destination
route.

## Document codec

`document_codec::EncodedView` is the lossless compact form of one document. The
compact tier and the base and head captures of `mokly-compare` share it.
`EncodedView::restore` rebuilds the exact bytes, parsed tree, and trusted
annotations without parsing authored HTML, or returns a
`document_error::CodecError`. An encoded view also lends its retained usage
records without a restore. An artifact without a composed document retains no
usage.

`EncodedView::encode_identified` also returns a `ContentIdentity`: a SHA-256
digest of the exact bytes, the annotated tree records, and every retained
metadata field. `EncodedView::comparison_identity` hashes a checked artifact
through the same codec input without compression. Equal identities prove
equal codec inputs. Only the caller keeps the identity. The render cache
tiers keep none.

## Captures and retained inputs

A comparison adapter can expose its existing capture through
`comparison_capture`. The comparison engine reuses that handle instead of
retaining another encoded copy of the same base. A smaller capture budget
returns to the original source recipes. Wrappers that add checks must return
`None` from `comparison_capture`, so rebuilding cannot bypass their checks.
Production callers supply fresh base generations.

`RenderGeneration::comparison_usage` returns the usage records of one view's
comparison document, or `None` when its artifact has no composed document. Its
default reads `comparison_document`, so it has the checks and errors of that
read. A comparison capture returns the retained usage of a kept view without a
restore, and reads every other view from its source. A wrapper that adds no
checks forwards this read, so that a capture below it still skips the restore.
A wrapper that adds checks keeps the default, so that each source read runs
those checks. It can forward the read only when the forwarded path still runs
all of its own checks, such as a cancellation check. Failed or missing usage
then goes to its own checked `comparison_document`, so its fallback checks and
its error handling stay.

`retained_comparison_input` returns a comparison input that the generation
already holds. It reads no source and logs nothing. `Ready` holds the decoded
document and its closure. `Deferred` holds the `ComparisonFallback` of one
failed restore. Its `document` logs the failure and reads the original source.
Its `closure` returns the kept closure.

The default returns `None`. A wrapper
that adds checks returns `None` when a forward would bypass those checks or
need source IO.

`retained_document_evidence` returns a `RetainedDocumentEvidence`: the codec
identity and the kept closure of one retained view, without a decode. A
generation returns it only when the restore of that view cannot fail. It reads
no source and logs nothing. The default returns `None`. A wrapper that adds
checks declines unless all of its checks still apply.

## Content proofs

`comparison_identity` proves one `ComparisonRead` of a route, a `Document`, a
`Closure`, or a `Resource`, with a `ContentIdentity`. `None` means unknown,
and the caller then compares the view in full. `ProofMode::Retained` permits
no source IO, restoration, or fallback. `ProofMode::Current` lets a head proof
read current resources, and a failed read returns `None`. A prepared
generation derives document and closure identities from the plan key and one
identity of the configuration, the roots, the sources, and the route sets.
These recipe identities do not prove equal bytes. The codec identity of
`EncodedView::comparison_identity` does. The default returns `None`. A wrapper
that adds checks keeps that default or applies its checks to the identity.

`comparison_document_proof` returns a `DocumentProof`: the current identity
and usage of one head document from one checked read. A failed check or an
unknown identity returns `None` and reports no error. The default calls this
generation's `comparison_document` and `comparison_identity`, so the checks
of a wrapper apply. An override must keep those checks.

## Source snapshots

`SourceSnapshot` forwards external read evidence to static admission without
replacing the witnessed bytes with a later snapshot hash. Stylesheet keys
include these versions separately from plugin declaration digests. Source
snapshots return `Arc<[u8]>` through `read_shared`, and cache hits share
storage. `digest_unretained` memoizes an opaque input hash without retaining
its payload. `SourceSnapshot::retained_bytes()` reports the retained private
payload per path. Parsed source snapshots have no byte eviction policy.
