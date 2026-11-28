# Large JSON snapshots are one long line

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-28, from branch `calummoore/compact-json-index-d33c`,
  review finding 6.
- **Location:** `crates/mokly-server/tests/http/routes_tests.rs:79-80` and
  `:114`, `crates/mokly-model/src/_tests_/public_reader_tests.rs:44-48`, and
  `crates/mokly-server/src/_tests_/publication_sequence/oracle_tests.rs:143-150`.
- **Reason:** The fix changes only how four tests show their snapshots, and
  the exported files do not depend on it.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Canonical encoder:** `canonical::to_string` in
    `crates/mokly-model/src/canonical.rs`. It writes the catalogue index and
    the entry details as compact JSON: object keys sorted by UTF-16 code
    units at every depth, no whitespace between tokens, and one final LF.
    Its output is a function of the JSON value only.
  - **Insta snapshot:** a `.snap` file that the Rust `insta` crate compares
    with the output of a test. `cargo insta review` shows the difference
    and accepts a new snapshot.
- **Background:**
  - Every exported JSON file of Mokly is compact. Four tests take an insta
    snapshot of compact bytes:
    - `pending_index`, at `routes_tests.rs:80`, in
      `crates/mokly-server/tests/http/snapshots/http_tests__http__routes_tests__pending_index.snap`.
      Line 79 first asserts that the served bytes equal the canonical
      encoding of the parsed index.
    - `pending_details`, at `routes_tests.rs:114`, in
      `crates/mokly-server/tests/http/snapshots/http_tests__http__routes_tests__pending_details.snap`.
      No byte assertion comes first.
    - `public_index_with_variant`, at `public_reader_tests.rs:45-48`, in
      `crates/mokly-model/src/_tests_/snapshots/mokly_model__readers__public_reader_tests__public_index_with_variant.snap`.
      The snapshot is the canonical encoding of the decoded index.
    - The oracle snapshot of `oracle_tests.rs:150`, in
      `crates/mokly-server/src/_tests_/publication_sequence/snapshots/mokly_server__publication_sequence__oracle_tests__several_edits_keep_every_byte_and_id_and_shared_details_keep_their_built_revision.snap`.
      It records the raw served bytes, and the snapshot itself pins them.
  - `crates/mokly-model/Cargo.toml:18` enables the `preserve_order` feature
    of `serde_json`. So a `serde_json::Value` that is parsed from canonical
    bytes keeps their key order, and `to_string_pretty` keeps their number
    spelling.
  - Run the tests with `cargo nextest run -p mokly-server` and
    `cargo nextest run -p mokly-model`, then accept new snapshots with
    `cargo insta review`.
- **Problem:** The four snapshots have lines of about 9,300, 3,700, 2,100,
  and 2,400 characters. A later change to one field shows as one changed
  line of thousands of characters in `git diff` and in `cargo insta review`.
- **Impact if no action:** Reviewers cannot see which field a snapshot
  change touches, so a wrong change is easier to miss. Each new large JSON
  snapshot adds to the problem.
- **Root question:** How do large JSON snapshot tests stay readable and
  still pin the exact output bytes?
- **Options:**
  - **A.** Change nothing. No cost. The four snapshots stay hard to
    review. Effort: Small.
  - **B.** In each of the four tests, assert that the bytes equal the
    canonical encoding of the bytes parsed into `serde_json::Value`. Then
    snapshot `serde_json::to_string_pretty` of that value. Canonical bytes
    are a function of the value, so the pretty view still pins every byte.
    The cost is the same few lines in four tests, and each new large
    snapshot must repeat them. Effort: Small.
  - **C.** Add one test helper, such as `pretty_canonical(bytes) -> String`,
    that makes the assertion of B and returns the pretty view. Use it in
    the four tests. Put it where both `mokly-model` and `mokly-server`
    tests can call it without a dependency cycle. The cost is one helper
    and the choice of its crate. Effort: Small.
- **Left out:**
  - insta's `assert_json_snapshot!`. It needs the `json` feature of
    `insta`, and it writes its own serialization, so it does not prove the
    exported bytes.
  - A pretty snapshot plus a SHA-256 line for the bytes. The hash line
    changes with every byte, and a reader cannot see the cause from it.
  - Keep byte snapshots in `canonical_tests`, `review_encoding_tests` in
    `crates/mokly-model`, and `metadata_tests` in `crates/mokly-publish`.
    There the snapshot is the encoder output under test, and the snapshots
    are short.
- **Wider fix:** C. One helper then serves every large JSON snapshot.
- **Previous examples:** None found.
- **Related:**
  - [snapshot-files-lack-descriptions.md](./snapshot-files-lack-descriptions.md):
    the same cause. A reviewer cannot judge a snapshot change. Three of
    the four snapshots here have no description.
- **Recommendation:** C. It costs about the same as B and makes every
  later large JSON snapshot readable with one call, which best protects
  the codebase.
- **Action:** fix after merge, apply C, because it changes only test
  sources and does not affect the exported files.
