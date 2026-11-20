# Mokly Cloud must check uploads with the lenient readers

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-03, from the branch `calummoore/rust-viewer-checks-plan`: the two post-merge tasks of the plan that moved the read-model checks out of the viewer.
- **Location:** The cloud receiver: `crates/mkc-mokly-contract/Cargo.toml`, the index parser `crates/mkc-mokly-contract/src/index.rs:28-43`, `crates/mkc-mokly-contract/src/index_validation.rs`, `crates/mkc-mokly-contract/README.md`, `crates/mkc-api/src/upload_complete.rs`, and `crates/mkc-publications/src/ingest.rs`. The cloud contract: `docs/protocol/cloud/publication-review.md`, sections "Content Check" and "Reader Conformance And Cloud Checks", `docs/protocol/cloud/mokly-artifact-compatibility.md`, sections "Version Boundary" and "Frame Boundary", `docs/protocol/cloud/publication-upload-validation.md`, section "Comparison Validation", `docs/protocol/cloud/publication-upload-exchange.md`, section "Completion", and `docs/protocol/cloud/viewer-catalogue.md`, section "Fetch And Version Gate". Each of these five cloud pages has a status line that links this item. The Mokly readers and rules: `crates/mokly-model/src/readers.rs`, `crates/mokly-model/src/detail_context.rs`, `crates/mokly-model/README.md`, `docs/protocol/mokly-upload-validation.md`, and `docs/protocol/mokly-catalogue-serialization.md`.
- **Reason:** The change that moved Mokly Cloud into this repository moves code without a change of behaviour, and this check changes which uploads the cloud API accepts.

- **Terms:**
  - **Read model:** the JSON that the Mokly core writes for the viewer: the
    catalogue index v9 at `mokly-viewer/index.json`, and one entry detail v4
    for each entry.
  - **Receiver:** a catalogue service that accepts the uploads of
    `mokly publish`, such as Mokly Cloud. `docs/protocol/mokly-upload-exchange.md`
    gives the exchange.
  - **Lenient readers:** `readers::index_lenient` and `readers::detail_lenient`
    in `crates/mokly-model/src/readers.rs:60` and `:92`. They apply the
    core's reader rules, but they ignore additive unknown fields.
  - **`mokly-model`:** the Rust crate of the Mokly core that owns the public
    shapes, the format numbers, and their readers. It is a crate of the
    Cargo workspace of this repository, and it is not on crates.io.
- **Background:**
  - Since 2026-10-10, a cloud requirement said that the cloud never accepts
    an upload that the viewer refuses. For Mokly 0.14.0, the receiver had a
    1,700-line Rust copy of the viewer's review reader, which still accepted
    reviews that the viewer refused. The item
    `plans/follow-ups/review-reader-accepts-viewer-refused-reviews.md`
    recorded that gap, and the 0.18.0 upgrade deleted it with the reader.
  - Mokly 0.17 removed the review file. Since then the receiver checks only
    the index fields that it reads: the base fields, the record paths and
    titles, `changes`, and the screen view axes. It ignores the other
    fields. The status line of each cloud page that the Location names
    records this gap. A corpus test proves that the Rust reader
    and `readCatalogueIndex` of `@mokly/viewer` give equal Changes counts.
  - On 2026-11-01 a docs agent of the Mokly 0.18.0 upgrade asked what the
    cloud promises for an upload whose index the viewer refuses. The
    options were: A, keep the narrow check; B, also check selected
    structural rules, such as tree membership; C, check the whole index in a
    second Rust copy of the viewer's reader; D, run `readCatalogueIndex` in a
    Node process at upload time; E, ask Mokly to publish its index rules as
    a Rust crate and run it. The recommendation was A. On 2026-11-02 the
    user deferred the choice, in the item
    `plans/follow-ups/receiver-index-checks-narrower-than-viewer.md`.
  - On 2026-11-03 the user chose to check the read model once, where it
    enters from outside, with the core's own Rust readers.
    - `@mokly/viewer` keeps only the format version gates, the delivery
      fences, and its URL rules. It trusts the content.
    - A document of a supported version that the viewer cannot render shows
      the viewer's error and retry state.
  - The same day the user chose that the core no longer checks its own
    output before it writes it. The readers of `mokly-model` stay only as
    the upload check of a receiver.
  - The user rejected two other ways:
    - The core's readers in the browser, as WebAssembly or as JavaScript from
      wasm2js. A trial on 2026-11-02 measured at least 350 KB more gzip for
      the shell, and 26 s in Chrome to read a large index with the full
      readers. No WebAssembly ships, and a receiver runs the readers natively
      in Rust.
    - A second copy of the rules in TypeScript, because the two copies drift.
  - That choice is option E of the cloud question, with the crate in this
    repository. On 2026-11-17 this item took in the cloud question. On
    2026-11-18 the old cloud repository still listed the question as a
    decision that waits for the user.
  - On 2026-11-19 the cloud pages that the Location names took the full
    check as their requirement. Each copy of a core reader rule became a
    link to `docs/protocol/mokly-upload-validation.md`, section Catalogue
    Content, or to `docs/protocol/mokly-paths.md`, section Segment Grammar.
    The pages keep only the cloud quotas, the 400 answer, and one rule that
    the core readers do not apply: every current and removed path is unique
    without ASCII case sensitivity. Each page got a status line that links
    this item. The completion order of `publication-upload-exchange.md` got
    the content check after the durable-blob check and before the publish.
  - The lenient readers check versions, known field types, relationships,
    and the field placement inside each tagged union. They ignore additive
    unknown fields in public records. A prop schema still rejects an unknown
    keyword.
  - Before they discard unknown fields, the lenient readers walk the original
    JSON for private evidence and unsafe public paths. The walk permits
    authored props and schema property names. It stops at a depth of 128 and
    at 5,000,000 visited values.
  - The strict readers `readers::index` and `readers::detail` stay. They
    reject every unknown field.
  - `docs/protocol/mokly-catalogue-serialization.md`, section Versions, gives
    the lenient rule:
    - The check reads the fields that the version defines and ignores any
      other field at every depth. So a receiver accepts the additive optional
      fields of a newer writer of the same format number.
    - A field that contradicts its own record's kind stays invalid, for
      example ready evidence on a pending state.
    - The privacy rules reject private evidence anywhere, and `usage` or
      `resourceEvidence` anywhere in the index.
  - `docs/protocol/mokly-upload-validation.md`, section Catalogue Content,
    gives the requirement:
    - Before it completes an upload, a receiver checks the index and every
      entry detail of the upload, current and removed.
    - A failed check answers 400 or 422. The CLI maps both statuses to
      `upload-invalid-bundle`, and it reads no rejection body.
  - The check adds no rule set of its own. It applies the rules of the
    core's readers as they are. Rules that only the old viewer applied are
    not part of it, for example a `relatedDocs` reference to a current
    document, a current and a removed record with one path, and select
    options. Those stay producer rules of the core.
  - `crates/mokly-model/README.md` gives these context rules:
    - A detail read alone cannot check the relationships that need its index.
    - `detail_context::validate(&detail, &index)` checks a current detail
      against its index: identity, deployment, revision, kind, exact views,
      and reason presence. It also checks the recorded usage against the
      index's component schemas.
    - It accepts a current detail only. A removed detail has a
      `snapshotId`, and the function rejects it.
    - A historical caller supplies the component schemas of the base
      catalogue to `usage_context`. An upload carries no base catalogue.
    - `UsageSchemas` compiles each used component schema once.
      `detail_context::validate_with` shares one `UsageSchemas` across the
      details of one publication.
  - Current details live under `mokly-viewer/entries/`. Removed details live
    under `mokly-viewer/diffs/generations/{generation}/entries/` in the
    comparison generation that the index's `comparisonUrl` names.
  - Details reach the receiver as content-addressed Blobs. An upload can
    reuse a Blob that an earlier upload stored. The context check depends on
    the index of this upload, so a reused Blob needs the check again.
  - The cloud may depend on the Mokly crates through their public API, as
    `docs/protocol/repository-layout.md`, section Boundary, states. A
    receiver outside this repository uses the Git dependency form of
    `crates/mokly-model/README.md`.
  - PR #285 added the lenient readers and removed the content checks of
    `@mokly/viewer`. It merged on 2026-11-06 as `b2196424`. `CHANGELOG.md`
    lists it as a breaking change of release 0.19.0, dated 2026-11-12.
  - In `@mokly/viewer` 0.19.0, `readCatalogueIndex` and `readEntryDetail`
    check only the format version, and then they return a copy of the
    value. So they trust the content. See
    `packages/viewer/src/catalogue/index_reader.ts:12-18` and
    `packages/viewer/src/catalogue/detail_reader.ts:12-18`, which are the
    same at the tag `v0.19.0`. The readers of 0.18.0 still checked every
    field.
  - The app embeds the workspace `@mokly/viewer` of this repository, at
    0.19.0 or later, with these readers.
  - Facts about Mokly Cloud, checked on 2026-11-18 at its `main` commit
    `767be7b2`. The paths and lines are those of this repository.
    - On 2026-11-03, Cloud commit `908484d2` moved the `@mokly/viewer` pin
      from 0.5.0 to 0.18.0. On 2026-11-17, Cloud commit `6d5163d6` moved it
      to 0.19.0.
    - The Deploy runs of both commits passed, including the job that deploys
      the production workloads:
      [run 41685858274](https://github.com/mokly-ai/mokly-cloud/actions/runs/41685858274)
      for `908484d2`, and
      [run 44092627866](https://github.com/mokly-ai/mokly-cloud/actions/runs/44092627866)
      for `6d5163d6`.
    - No cloud crate depends on `mokly-model`.
      `crates/mkc-mokly-contract/Cargo.toml` has no dependency on a Mokly
      crate.
    - The receiver reads no entry detail.
    - The receiver reads the index only with its own parser,
      `crates/mkc-mokly-contract/src/index.rs:28-43`. The parser accepts
      index version 9 only, and it answers 426 for another version. It
      checks only the index fields that the receiver reads.
  - So no part of Mokly Cloud checks the content of an upload beyond the
    read index fields. The Mokly pages and the cloud pages that the last Task
    step names carry status lines for this gap.
  - The first order of this item was the receiver check first and the viewer
    upgrade second. That order did not happen. Cloud adopted a viewer that
    trusts the content before its receiver had the shared lenient index
    checks or any entry detail check. Cloud still checks the index fields
    that its receiver reads. The impact below applies now.
  - History: on 2026-11-03, Cloud pinned `@mokly/viewer` 0.5.0, whose
    readers still checked the content. On the same day, its two content
    security policies blocked WebAssembly. The check of 2026-11-18 did not
    cover the WebAssembly fact.
  - The post-merge task
    [cloud-contract-types-use-mokly-model.md](./cloud-contract-types-use-mokly-model.md)
    replaces the cloud's own Mokly contract types in `mkc-mokly-contract`
    with the `mokly-model` types. Both changes touch the same crate.
- **Task:**
  1. Add `mokly-model` as a workspace dependency of `mkc-mokly-contract`.
     The receiver and the embedded workspace `@mokly/viewer` then read the
     same format numbers.
  2. Before Complete succeeds, read `mokly-viewer/index.json` with
     `readers::index_lenient`.
  3. Read each current detail with `readers::detail_lenient`. Then check it
     with `detail_context::validate_with` against that index, and share one
     `UsageSchemas` across the upload.
  4. Read each removed detail with `readers::detail_lenient`. Add no rule
     that the readers do not apply.
  5. Check every detail that the ownership marker lists. This includes a
     Blob that an earlier upload stored. Check the decoded bytes, after the
     digest and size checks of `docs/protocol/mokly-upload-validation.md`.
  6. Answer 400 or 422 when a check fails. Publish nothing for that upload.
     Keep the version gate, which answers 426, before the content check.
  7. Make the receiver meet the cloud pages that the Location names. They
     already state the full check through links to the Mokly pages, so they
     need no new rule. Keep the cloud quotas, the 400 answer, and the rule
     that every current and removed path is unique without ASCII case
     sensitivity, because the core readers do not apply it. The decision of
     2026-11-03 stays in `docs/protocol/mokly-upload-validation.md`, section
     Catalogue Content, and the cloud pages link it. Rewrite the section
     "Reader Conformance And Cloud Checks" of
     `docs/protocol/cloud/publication-review.md` for the reader that the
     receiver then runs.
  8. Deploy the receiver, and smoke-test it:
     - Publish a good catalogue, such as `examples/basic/mokly.config.json`.
       Cloud accepts it, and the embedded viewer shows it.
     - Publish a bad catalogue, for example one with `usage` in an index
       record or a detail with an invalid instance key. Cloud answers 400
       or 422, and the CLI reports `upload-invalid-bundle`.
  9. Remove the receiver clauses of the status lines that link this item
     from `docs/protocol/mokly-upload-validation.md`,
     `docs/protocol/mokly-catalogue-serialization.md`,
     `docs/protocol/mokly-viewer-namespace.md`,
     `docs/protocol/mokly-component-props.md`,
     `docs/protocol/mokly-component-usage-records.md`,
     `docs/protocol/mokly-shell-delivery.md`, and
     `docs/architecture/package-boundary.md`. Keep status clauses owned by
     other follow-up items. Remove the status lines that link this item from
     the cloud pages `docs/protocol/cloud/publication-review.md`,
     `docs/protocol/cloud/mokly-artifact-compatibility.md`,
     `docs/protocol/cloud/publication-upload-validation.md`,
     `docs/protocol/cloud/publication-upload-exchange.md`, and
     `docs/protocol/cloud/viewer-catalogue.md`. Update the sentence of
     `crates/mkc-mokly-contract/README.md` that says which index fields the
     reader checks.
- **Impact if no action:** Cloud already runs `@mokly/viewer` 0.19.0, which
  trusts the content. Its receiver lacks the shared lenient index checks and
  every entry detail check. It still checks its own index read fields. So
  uploaded JSON reaches the viewer without the shared checks now. Private
  evidence then passes the privacy rules. A malformed catalogue is
  published: the app shows the viewer's error state, whose retry can never
  succeed, and the GitHub check can show counts for a catalogue that never
  opens.
- **Needs:** Deploy access for the smoke test of the deployed receiver. The
  merged change and its release, 0.19.0 with the matching `@mokly/viewer`,
  already exist.
- **Done when:** The deployed Cloud receiver rejects the bad upload with 400
  or 422, and the CLI reports `upload-invalid-bundle`. It accepts the good
  upload, and the embedded viewer shows that catalogue. The status lines
  that link this item are gone from the Mokly pages and from the five cloud
  pages that the Location names.
- **Related:**
  - [hosted-upload-reuse-check.md](./hosted-upload-reuse-check.md) confirms
    that uploads reuse unchanged detail Blobs. This task checks those reused
    Blobs again against each new index.
  - [cloud-removed-detail-source.md](./cloud-removed-detail-source.md) checks
    the same embedded viewer upgrade for removed entries.
