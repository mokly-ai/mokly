# Large JSON snapshots are one long line

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-29, from branch `calummoore/compact-json-index-d33c`,
  review finding 6.
- **Location:**
  `crates/mokly-server/tests/http/routes_tests.rs:76-114`,
  `crates/mokly-model/src/_tests_/public_reader_tests.rs`, and
  `crates/mokly-server/src/_tests_/publication_sequence/oracle_tests.rs:143-150`.
- **Reason:** The fix changes only how tests show their snapshots, and the
  compact output does not need it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Canonical encoder:** `canonical::to_string` in
    `crates/mokly-model/src/canonical.rs`. It writes the catalogue index and
    the entry details as compact JSON, with no whitespace between tokens and
    one final LF.
  - **Insta snapshot:** a `.snap` file that the Rust `insta` crate compares
    with the output of a test. `cargo insta review` shows the difference.
- **Background:** Every exported JSON file of Mokly is compact. Some tests
  take an insta snapshot of these bytes. Some of them, such as
  `routes_tests.rs:79`, first assert that the served bytes equal
  `canonical::to_string` of the parsed value, so the snapshot does not need
  the exact bytes to pin them.
- **Problem:** Four snapshots are now very long lines:
  `http_tests__http__routes_tests__pending_index.snap` (one line of about
  9,300 characters), `http_tests__http__routes_tests__pending_details.snap`
  (about 3,700), `mokly_model__readers__public_reader_tests__public_index_with_variant.snap`
  (about 2,100), and the oracle snapshot of `oracle_tests.rs` (lines up to
  about 2,400). A later change to one field shows as one changed line of
  thousands of characters in `git diff` and in `cargo insta review`.
- **Impact if no action:** Reviewers cannot see which field a snapshot
  change touches, so a wrong change is easier to miss. Each new large JSON
  snapshot adds to the problem.
- **Root question:** How do large JSON snapshot tests stay readable and
  still pin the exact output bytes?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** In tests that already assert byte equality with the canonical
    encoder, snapshot `serde_json::to_string_pretty` of the parsed value.
    `crates/mokly-model/Cargo.toml` enables the `preserve_order` feature of
    `serde_json`, so key order and number spelling stay the same. Keep byte snapshots where
    the snapshot is the encoder output under test, such as
    `canonical_tests`, `review_encoding_tests`, and `metadata_tests`.
    Effort: Small.
  - **C.** Add one shared test helper that asserts the canonical bytes and
    returns a pretty view for the snapshot. Use it for every large JSON
    snapshot. Effort: Medium.
- **Left out:** None.
- **Wider fix:** C. One helper then serves every large JSON snapshot.
- **Previous examples:** None found.
- **Recommendation:** B. It makes the four largest snapshots readable and
  keeps the byte checks.
- **Action:** fix after merge, apply B, because it changes only test
  sources and does not affect the exported files.
