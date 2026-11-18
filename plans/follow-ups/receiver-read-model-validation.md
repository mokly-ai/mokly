# Mokly Cloud must check uploads with the lenient readers

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-03, from the branch `calummoore/rust-viewer-checks-plan`: the two post-merge tasks of the plan that moved the read-model checks out of the viewer.
- **Location:** `mokly-ai/mokly-cloud`, outside this repository: its upload receiver, its contract crate `mkc-mokly-contract` with the index parser [`crates/mkc-mokly-contract/src/index.rs:28-43`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/crates/mkc-mokly-contract/src/index.rs#L28-L43), and [`ts/app/package.json:22`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/ts/app/package.json#L22), which pins `@mokly/viewer` 0.19.0 on 2026-11-18. In this repository: `crates/mokly-model/src/readers.rs`, `crates/mokly-model/src/detail_context.rs`, `crates/mokly-model/README.md`, `docs/protocol/mokly-upload-validation.md`, and `docs/protocol/mokly-catalogue-serialization.md`.
- **Reason:** The change that adds the lenient readers merged and shipped in release 0.19.0, but the receiver work is a change in `mokly-ai/mokly-cloud`, outside this repository.

- **Terms:**
  - **Read model:** the JSON that the Mokly core writes for the viewer: the
    catalogue index v9 at `mokly-viewer/index.json`, and one entry detail v4
    for each entry.
  - **Receiver:** a catalogue service that accepts the uploads of
    `mokly publish`, such as Mokly Cloud. `docs/protocol/mokly-upload-exchange.md`
    gives the exchange.
  - **Lenient readers:** `readers::index_lenient` and `readers::detail_lenient`
    in `crates/mokly-model/src/readers.rs`. They apply the core's reader rules,
    but they ignore additive unknown fields.
  - **`mokly-model`:** the Rust crate of the Mokly core that owns the public
    shapes, the format numbers, and their readers. It is not on crates.io.
- **Background:**
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
  - The README gives the Git dependency form. Replace `{commit}` with the
    reviewed, merged commit:
    `mokly-model = { git = "https://github.com/mokly-ai/mokly", rev = "{commit}" }`.
  - PR #285 added the lenient readers and removed the content checks of
    `@mokly/viewer`. It merged on 2026-11-06 as `b2196424`. `CHANGELOG.md`
    lists it as a breaking change of release 0.19.0, dated 2026-11-12.
  - In `@mokly/viewer` 0.19.0, `readCatalogueIndex` and `readEntryDetail`
    check only the format version, and then they return a copy of the
    value. So they trust the content. See
    `packages/viewer/src/catalogue/index_reader.ts` and
    `packages/viewer/src/catalogue/detail_reader.ts` at the tag `v0.19.0`.
    The readers of 0.18.0 still checked every field.
  - Facts about Mokly Cloud, checked on 2026-11-18 at its `main` commit
    `767be7b2`:
    - `ts/app/package.json:22` pins `@mokly/viewer` 0.19.0. On 2026-11-03,
      Cloud commit `908484d2` moved the pin from 0.5.0 to 0.18.0. On
      2026-11-17, Cloud commit `6d5163d6` moved it to 0.19.0.
    - The Deploy runs of both commits passed, including the job that deploys
      the production workloads:
      [run 41685858274](https://github.com/mokly-ai/mokly-cloud/actions/runs/41685858274)
      for `908484d2`, and
      [run 44092627866](https://github.com/mokly-ai/mokly-cloud/actions/runs/44092627866)
      for `6d5163d6`.
    - No `Cargo.toml` or `Cargo.lock` of Cloud depends on `mokly-model`.
    - The receiver reads no entry detail.
      [`docs/protocol/publication-review.md:10`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/docs/protocol/publication-review.md?plain=1#L10)
      of Cloud says the same.
    - The receiver reads the index only with its own parser,
      `crates/mkc-mokly-contract/src/index.rs:28-43`. The parser accepts
      index version 9 only, and it answers 426 for another version. It
      checks only the index fields that the receiver reads.
  - So the order of the Task did not happen. The Task deploys the receiver
    check first and upgrades the viewer second. Cloud adopted a viewer that
    trusts the content before its receiver had the shared lenient index
    checks or any entry detail check. Cloud still checks the index fields
    that its receiver reads. The impact below applies now.
  - History: on 2026-11-03, Cloud pinned `@mokly/viewer` 0.5.0, whose
    readers still checked the content. On the same day, its two content
    security policies blocked WebAssembly. The check of 2026-11-18 did not
    cover the WebAssembly fact.
- **Task:**
  1. In `mokly-ai/mokly-cloud`, add `mokly-model` as a Git dependency pinned
     to a reviewed, merged commit. Use the commit of the Mokly release whose
     `@mokly/viewer` Cloud pins, so that both read the same format numbers.
     On 2026-11-18 that release is 0.19.0, at the tag `v0.19.0`.
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
  7. Deploy the receiver. Keep the `mokly-model` commit on the release of the
     `@mokly/viewer` pin. The planned order was the receiver check first and
     the viewer upgrade second. That order did not happen. Cloud already pins
     `@mokly/viewer` 0.19.0, which trusts the content. Its receiver still
     lacks the shared lenient index checks and every entry detail check.
  8. Smoke-test the deployed receiver:
     - Publish a good catalogue, such as `examples/basic/mokly.config.json`.
       Cloud accepts it, and the embedded viewer shows it.
     - Publish a bad catalogue, for example one with `usage` in an index
       record or a detail with an invalid instance key. Cloud answers 400
       or 422, and the CLI reports `upload-invalid-bundle`.
  9. In this repository, remove the status lines that link this item from
     `docs/protocol/mokly-upload-validation.md`,
     `docs/protocol/mokly-catalogue-serialization.md`,
     `docs/protocol/mokly-viewer-namespace.md`,
     `docs/protocol/mokly-component-props.md`,
     `docs/protocol/mokly-component-usage-records.md`,
     `docs/protocol/mokly-shell-delivery.md`, and
     `docs/architecture/package-boundary.md`. Remove only the receiver
     clauses. Keep status clauses owned by other follow-up items.
- **Impact if no action:** Cloud already runs `@mokly/viewer` 0.19.0, which
  trusts the content. Its receiver lacks the shared lenient index checks and
  every entry detail check. It still checks its own index read fields. So
  uploaded JSON reaches the viewer without the shared checks now. Private
  evidence then passes the privacy rules, and a malformed catalogue shows
  the viewer's error state.
- **Needs:** Write and deploy access to `mokly-ai/mokly-cloud`. The merged
  change and its release, 0.19.0 with the matching `@mokly/viewer`, already
  exist.
- **Done when:** The deployed Cloud receiver rejects the bad upload with 400
  or 422, and the CLI reports `upload-invalid-bundle`. It accepts the good
  upload. The embedded viewer on the pinned release shows that catalogue.
  The status lines that link this item are gone.
- **Related:**
  - In `mokly-ai/mokly-cloud`,
    [`plans/follow-ups/receiver-index-checks-narrower-than-viewer.md`](https://github.com/mokly-ai/mokly-cloud/blob/767be7b25b1c2aa3138491f32afcc43f20fb2f4f/plans/follow-ups/receiver-index-checks-narrower-than-viewer.md)
    is a decision that waits for its user. It asks what Cloud promises for
    an upload whose index the pinned viewer refuses. Its option E runs the
    index rules of Mokly as a Rust crate at the exact pin. That is the index
    part of this task. Its background still says that the app checks the
    whole index with `readCatalogueIndex`. Since 0.19.0, that reader checks
    only the version. Coordinate this task with the answer to that decision.
  - [hosted-upload-reuse-check.md](./hosted-upload-reuse-check.md) confirms
    that uploads reuse unchanged detail Blobs. This task checks those reused
    Blobs again against each new index.
  - [cloud-removed-detail-source.md](./cloud-removed-detail-source.md) checks
    the same embedded viewer upgrade for removed entries.
