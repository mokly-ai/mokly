# mokly-graph stylesheets, assets, and source protection

This page is part of the [`mokly-graph` README](./README.md). It holds the
stylesheet, asset, and source protection guidance of the crate. The first
sections cover the stylesheet roots and the assets. The last sections cover
the public file policy and the closure validation. The [Key Code](#key-code)
list names the entry points of these parts.

## Stylesheet roots

Configured and declared stylesheet roots and
links name local stylesheets by `ResolvedConfig::repository_path`. Completed
JavaScript, stylesheet, PostCSS, and asset inputs populate the prepared
catalogue's dependency-directory set.
Cached bundles supply the same set. Old cache-validation reads and filename
suffixes cannot add or hide dependency usage. Preparation bundles the
stylesheet roots on the render workers, then registers the bundles in root
order. With deterministic plugins, the delivered generation, its key, and its
first error therefore do not depend on worker timing. No root starts after an
earlier root failed. Each root job checks
worker cancellation, and preparation checks it before each entry. A prepared generation exposes the same worker cancellation
through `check_cancelled` for callers that process views in a loop.

## Assets

Opaque CSS asset preparation retains source identities and digests. A shared
asset path has one generated resource plan across stylesheet roots. Bundles,
source snapshots, and render caches retain no opaque payload for preparation.
Callers can also supply imported assets through `DeliveryInputs`. These
assets join the same resource plans before document validation, including
assets that no document references. They share routes with stylesheet assets
at the same logical path. Each input supplies its confined source identity,
digest, aliases, and importing module. Each comparison side uses its own inputs.
Final document composition rewrites asset tokens whose paths are portable.
It creates document-relative URLs beside logical links before URL and closure
checks. Collected style text and attribution records receive the same URLs.
Rule ownership stays unchanged. Replacement does not depend on asset membership.
A reference to an undelivered asset fails the existing
closure check as a missing target. Asset membership does not enter document
keys, so equal render inputs share cached documents across generations and sides.
`open_asset` supplies a `dyn AssetRead` stream. Its checked copy fails with
`GraphError::InputsChanged` if the captured digest or opened length differs.
Consumers keep copied bytes private until verification succeeds. Static output
retains one final immutable payload. Serve streams a verified temporary file.
Asset opens report `InputsChanged` for vanished paths, stopped symbolic-link
resolution, and non-regular replacements. Other open errors keep their IO
diagnostic. Explicit cancellation retains the cancelled runtime diagnostic.

## Public file policy

`FilePolicy` is the one policy of the public closure contract for one
generation. `Walker` follows HTML and CSS references and renderer seeds.
Each `MemoryReferenceIndex` reads the inline style scans of the walk through
the style memo that `DeliveryInputs` passes in. The render runtime passes one
memo to all its generations, so an equal inline style text reuses a scan that
the bounded memo still holds.
Package directories come from the normalized `ResolvedConfig::package_roots`.
Repository aliases and case aliases do not make their files public.
Watch-input fingerprints use repository-relative POSIX names on every
platform. The working-tree adapter implements `mokly_source_interface::tree::SourceTree`. Historical rendering
supplies the same boundary through the comparison adapter. `mokly-render`
supplies the JavaScript factories and selected base dependencies through that
path. Serve must also apply the public policy's read-time confinement rules.

## Closure validation

`RenderGeneration::comparison_document` composes the same tree before closure
validation. Both sides validate reached resources under the
[public closure contract](../../docs/protocol/mokly-public-closure.md).
Historical checkout failures keep a `base-conversion` warning in the closure
and omit that file from delivery. `ResourceUnavailable` preserves this state
through resource byte and digest access. Other closure work continues.
`resource_bytes` reads confined public routes without granting access to
private sources or retaining assets in the private source snapshot.
`resource_digest` hashes opaque resources through a bounded stream. Generated
document resource reads use the same rendered bytes and digest as their views,
including after cache eviction. Closure traversal stops at declared documents,
so embedded catalogue cycles terminate. Closure evidence retains exact logical
instance and referring edge context for comparison proof.

## Key Code

- [`src/styles.rs`](./src/styles.rs) provides `local_roots`, the roots of the
  local stylesheets that the configuration and component declarations name.
- [`src/imported_assets.rs`](./src/imported_assets.rs) checks imported route
  portability and registers shared asset plans and protected source inputs.
- [`src/asset_tokens.rs`](./src/asset_tokens.rs) rewrites portable asset
  tokens for each document route with the shared stylesheet path rule. It
  keeps rule text equal between collected CSS and its attribution records.
- [`src/asset_delivery.rs`](./src/asset_delivery.rs) defines `AssetRead`, the
  digest-checked opaque asset stream.
- [`src/policy.rs`](./src/policy.rs) and [`src/closure.rs`](./src/closure.rs)
  define `FilePolicy` and `Walker`, the public-file policy and the referenced
  closure walk. `FilePolicy` gives a reported stylesheet input the
  `PublicDenial::Vite` reason of [`src/public_denial.rs`](./src/public_denial.rs)
  under the Vite adapter, and the `PublicDenial::Postcss` reason otherwise.
- `ClosureBuilder::collect_recorded` reports each input of the walk to a
  `ValidationRecorder`. Its default marks the walk unknown, so a builder that
  cannot record its inputs keeps no facts. The private
  [`src/closure_walk.rs`](./src/closure_walk.rs) holds the one walk that
  `Walker::collect` and `Walker::collect_recorded` run.
- [`src/reference_index.rs`](./src/reference_index.rs) defines
  `ReferenceIndex` and `MemoryReferenceIndex`, the reference edges of each
  referenced file of one generation and its reads of the style memo.
