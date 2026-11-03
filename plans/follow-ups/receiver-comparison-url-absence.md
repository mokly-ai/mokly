# Receiver accepts a missing comparison URL

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-03, from the branch `calummoore/rust-viewer-checks-plan`: finding 6 of its second review round, confirmed by an independent check.
- **Location:** `crates/mokly-model/src/public_index.rs:147-149`; `crates/mokly-model/src/readers.rs:52-69` and `:147-153`; `crates/mokly-model/src/_tests_/reader_null_tests.rs:75-91`; `packages/viewer/src/catalogue/index_reader.ts:12-17`; `packages/viewer/src/shell/projection.ts:34-36`; `packages/viewer/src/shell/comparison_request.ts:47-54` and `:117-129`; `packages/viewer/src/previews/request.ts:77-81`.
- **Reason:** Every option needs a user answer that no record holds: A and D add a new rejection to both Rust readers, and B and C change the read-model contract.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Catalogue index:** the public JSON document `mokly-viewer/index.json`,
    format v9, that lists the entries and their comparison state.
  - **Receiver:** a catalogue service, such as Mokly Cloud, that checks the
    uploads of `mokly publish` before it hosts them.
  - **Index readers:** the receiver's `readers::index_lenient`, which ignores
    additive unknown fields, and the strict `readers::index`, which rejects
    them. Both are in `crates/mokly-model/src/readers.rs`.
  - **`comparisonUrl`:** the index field that gives the root of the
    comparison generation, or null when the catalogue has no comparison.
  - **Pinned delivery:** the comparison delivery of the embedded viewer. It
    takes the comparison root from the installed index, not from Serve.
- **Background:**
  - The generated type `CatalogueReadModel` declares
    `comparisonUrl: string | null` at
    `packages/viewer/src/generated/catalogue/CatalogueReadModel.ts:51`. The
    field is required, and null means no comparison.
  - `docs/protocol/mokly-catalogue-serialization.md`, section Versions, calls
    the generated types the normative shapes. A receiver checks the index and
    every entry detail of an upload against these shapes with the core's
    readers.
  - `docs/protocol/mokly-catalogue-delivery.md` says that `comparisonUrl` is
    `null` or `mokly-viewer/diffs/generations/{generation}/`. A null value
    forbids a fallback request to `/mokly-viewer/diffs/selection`.
  - `docs/protocol/mokly-removed-previews.md` says that a catalogue with
    `comparisonUrl: null` shows the unavailable state without a request.
  - `docs/protocol/mokly-upload-validation.md`, section Catalogue Content,
    says that a receiver runs the core's readers, not a second copy of their
    rules. Its reason: two copies drift, and a viewer then cannot read a
    catalogue that the receiver accepted.
  - On 2026-11-03 the user chose to check the read model once, where it
    enters, with the core's Rust readers. The viewer keeps only the format
    version gates and the delivery fences, and it trusts the content.
    `docs/protocol/mokly-viewer.md`, section Package And Props, states it.
    `readCatalogueIndex` at `packages/viewer/src/catalogue/index_reader.ts:12-17`
    checks the version and returns `structuredClone(value)`.
  - The upload files are byte-identical to the finalized output, and the
    ownership marker records the digest and size of each file, under
    `docs/protocol/mokly-upload-exchange.md`. So a receiver cannot add a
    missing field to a stored index.
  - Every index v9 writer writes the field.
    `crates/mokly-model/src/projection.rs:69` writes null.
    `crates/mokly-static/src/comparison_output.rs:67` and
    `crates/mokly-server/src/changes.rs:179` write a generation root. The Rust
    field has no `skip_serializing_if`, so `None` becomes null.
  - No product code of the CLI, Serve, or the static build calls the index
    readers. Tests call both, and a receiver calls `index_lenient`.
    `plans/follow-ups/receiver-read-model-validation.md` holds the post-merge
    task that makes Mokly Cloud call it. Cloud follows the chosen rule after
    it pins a Mokly commit that contains it.
  - The field carries `#[serde(default, deserialize_with = "nullable::read")]`
    at `crates/mokly-model/src/public_index.rs:148`.
    - `nullable::read` in `crates/mokly-model/src/read_decode/nullable.rs`
      accepts a present string or a present null.
    - The `default` reads an absent field as `None`. Without it, Serde
      reports a missing field, because the field has a `deserialize_with`.
  - A review fix of 2026-11-03 made both readers decode each supplied
    optional value as its declared type. It wrote the attribute pair above.
    It kept the acceptance of an absent `comparisonUrl` on purpose, because
    no user answer authorized a new rejection. The acceptance stays until the
    user answers this item.
  - An agent design call of 2026-11-03 says that the former viewer-only read
    rules do not move to Rust.
    `plans/follow-ups/receiver-read-model-validation.md` says the same.
    Neither is a user answer. On `origin/main`, only the viewer rejected an
    absent `comparisonUrl`.
- **Problem:** Both index readers accept an index without `comparisonUrl`,
  and they return `None`. The test
  `nullable_comparison_constants_and_tagged_props_keep_their_values` at
  `crates/mokly-model/src/_tests_/reader_null_tests.rs:75-91` requires that
  acceptance in both modes. The stored index still omits the field, so the
  viewer's copy holds `undefined`, which the generated type does not allow:
  - `packages/viewer/src/shell/projection.ts:34-36` reads `undefined !== null`
    as an available comparison. `packages/viewer/src/shell/workspace.tsx:71`
    and `:230` then offer the comparison controls.
  - The pinned delivery passes `undefined` at
    `packages/viewer/src/viewer/environment.ts:46-48`. `advertisedRoot` at
    `packages/viewer/src/shell/comparison_request.ts:117-129` then gives no
    root, and the request at `:47-54` fetches `/mokly-viewer/diffs/selection`.
    The delivery contract forbids that request. Only Serve answers it, so the
    viewer shows "The comparison is unavailable."
  - For an advertised removed preview, `previewEndpoint` at
    `packages/viewer/src/previews/request.ts:81` calls `replace` on
    `undefined` and throws a `TypeError`.
    `packages/viewer/src/shell/use_removed_preview.ts:225-234` catches it and
    shows the failed state with Retry, not the required unavailable state.
  - The catalogue still renders. No data is lost, and no wrong content shows.
- **Impact if no action:** A receiver can accept an index that the viewer
  reads as a catalogue with a comparison, so each comparison surface of that
  catalogue fails. Only an upload that Mokly did not write meets it.
- **Root question:** How does every index that a receiver accepts give its
  readers a defined comparison state?
- **Options:**
  - **A.** Require `comparisonUrl`, with null for no comparison. Remove the
    `default` at `crates/mokly-model/src/public_index.rs:148`, and keep
    `deserialize_with = "nullable::read"`. Effort: Small.
    - The new rejection: both index readers reject an index without the
      field with `ReadError::Invalid`, boundary `catalogue index`, and the
      Serde error "missing field `comparisonUrl`". A receiver then answers
      400 or 422, and the CLI reports `upload-invalid-bundle`.
    - Both readers still accept `comparisonUrl: null` and a generation root.
    - The lenient reader still accepts `const: null`, tagged null props, and
      unknown additive fields, also when their value is null. The strict
      reader still rejects unknown fields.
    - Change the missing-field case of
      `nullable_comparison_constants_and_tagged_props_keep_their_values` so
      that it expects the rejection in both modes. Keep its null case.
    - The generated type stays `comparisonUrl: string | null`. No writer,
      fixture, or viewer code changes.
  - **B.** Support omission in the normative shape. Mark the Rust field
    `#[ts(optional)]`, so the generated type becomes
    `comparisonUrl?: string | null`. State in
    `docs/protocol/mokly-catalogue-delivery.md` that an absent field means
    null. Make `projection.ts`, `environment.ts`, `comparison_request.ts`,
    `previews/request.ts`, and the other viewer consumers treat omission like
    null. Producers keep writing the field. It loosens the published type, so
    every consumer handles a third state that no Mokly writer makes.
    Effort: Medium.
  - **C.** Keep the required shape and both readers. Make
    `readCatalogueIndex` copy an absent `comparisonUrl` as `null`, so each
    viewer consumer gets the declared `string | null`. State this reader
    tolerance in `docs/protocol/mokly-catalogue-serialization.md` and
    `docs/protocol/mokly-viewer.md`. Writers must still write the field. Add
    a viewer regression with an index without the field. It adds one content
    repair to a viewer that otherwise trusts the content. Host code that
    reads the raw JSON, such as the example at
    `packages/viewer/README.md:96-97`, still gets no value. Effort: Small.
  - **D.** Add a required nullable field type to `mokly-model`, such as
    `Nullable<T>`. It decodes only a present value or a present null, so
    Serde reports an absent field as missing. It has no `Default`, and it
    generates `T | null`. Use it for `comparisonUrl`, and remove the
    attribute pair. A later `#[serde(default)]` on such a field then does not
    compile. Update the users of the field at
    `crates/mokly-model/src/removed_validation.rs:15` and `:83`,
    `crates/mokly-model/src/projection.rs:69`,
    `crates/mokly-static/src/comparison_output.rs:67`,
    `crates/mokly-server/src/changes.rs:179`, and
    `crates/mokly-cli/tests/static_output_tests.rs:92`. Change the test as in
    A. It adds the same rejection as A, and a type for a class with one member
    today. Effort: Medium.
- **Left out:**
  - Normalize only the decoded Rust value: it already happens, and the viewer
    reads the original bytes, so it fails the goal.
  - Rewrite the stored bytes: it breaks the byte identity and the digests of
    the upload exchange, which stay.
  - Keep the current mismatch: it fails the goal.
  - A viewer check that shows the failure state: it breaks the user's choice
    of 2026-11-03 that the viewer checks no content.
  - A presence rule in Mokly Cloud: it breaks the decision that a receiver
    runs the core's readers, not rules of its own.
  - A rejection in the lenient mode only: A is better on every point. Only
    tests call the strict reader, and a split gives one field two rules.
- **Wider fix:** D. It makes a defaulted required nullable field impossible
  to write, so the class cannot recur. It is blocked like A, because it adds
  the same rejection. The nullable helper alone does not prevent the class,
  because a field-local `default` turns its presence rule off.
- **Previous examples:**
  - On `origin/main` at `f08d02df`, the Rust readers also accepted an absent
    field through a plain `comparison_url: Option<String>`. Commit `f93afcea`
    of 2026-10-29, which introduced index v9, has the same declaration.
  - On `origin/main` at `f08d02df`, the viewer rejected the absent field.
    `packages/viewer/src/catalogue/index_reader.ts:40` called
    `comparisonPath`, and `packages/viewer/src/catalogue/values.ts:62-64`
    passed `undefined` to `string()`, which threw "expected a string". The
    test "the comparison URL is a generation path, or null without previews"
    at `packages/viewer/tests/index_reader.test.ts:196-199` covered it.
  - The change that moved the content checks out of the viewer removed that
    rejection and its test. No other earlier example was found.
- **Recommendation:** A. Both readers then enforce the published
  `string | null` shape that every index v9 writer already meets, so every
  reader of the type stays safe. D best protects the codebase, because it
  makes a defaulted required nullable field impossible to write.
- **Action:** ask the user, because A and D add a new rejection to both
  readers, B and C change the read-model contract, and no recorded user
  answer covers any of them.
- **Done when:** The user chose an option, and a branch applied it and
  deleted this item. The tests then show the chosen rule:
  - A or D: both index readers reject an index without `comparisonUrl`. They
    accept `comparisonUrl: null` and a generation root. The lenient reader
    still accepts `const: null`, tagged null props, and unknown additive
    fields with null values.
  - B: the generated type marks the field optional, and a viewer regression
    shows an index without the field as a catalogue without a comparison.
  - C: a viewer regression shows that `readCatalogueIndex` copies an absent
    field as null, and both contracts state the tolerance.
