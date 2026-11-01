# Corpus tests read fixtures inside unit tests

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-87-diagnostics-and-html-messages`, the finding
  check of finding 11 of its implementation review.
- **Location:** `crates/mokly-html/src/_tests_/html5lib_corpus_tests.rs:17-48`,
  `crates/mokly-html/src/_tests_/pipeline_differential_tests.rs:13-31`, and
  `crates/mokly-html/tests/source_map_corpus_tests.rs:10-49`.
- **Reason:** The two unit tests that read files came to `main` in commit
  `02eec937`, before the change that found them.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Vendored corpus:** the HTML test inputs under
    `crates/mokly-html/tests/fixtures`: the html5lib tree-construction
    corpus in `html5lib`, as `.dat` files, and the tracked parser inputs in
    `differential`.
  - **`.dat` file:** the html5lib test format. Each case starts with a
    `#data` line, and its input ends at the `#errors` line.
  - **Reference parser:** html5ever's own tree builder, which the tests
    reach through the private `html_arena::Arena` in
    `crates/mokly-html/src/html_arena.rs`, by the helpers
    `legacy_delivered_document`, `legacy_delivered_fragment`, and
    `legacy_authored_document` in `crates/mokly-html/src/_tests_/support.rs`.
- **Background:**
  - The `rust` skill and `testing/references/deterministic-tests.md` say
    that unit tests must not use real disk IO. Integration tests may use
    real files.
  - The `testing` skill says to read a file format through the product's
    readers or through one test helper, not to copy it into each test.
  - `html5lib_corpus_tests.rs` walks `tests/fixtures/html5lib` with
    `fs::read_dir`, reads each `.dat` file with `fs::read_to_string`, splits
    the cases at `#data`, ends each input at `#errors`, and asserts 1796
    cases. It checks that the shared driver parses each input to the
    reference tree.
  - `pipeline_differential_tests.rs` reads each file of
    `tests/fixtures/differential` with `fs::read_dir` and
    `fs::read_to_string`, asserts 55 files, and checks each tree and its
    position snapshot.
  - Both are library unit tests: `crates/mokly-html/src/lib.rs` declares
    them as `#[cfg(test)]` modules. They need the private reference parser,
    so they cannot move to `tests/` as they are.
  - On 2026-11-01 the source-map corpus property test
    `corpus_source_maps_are_monotonic_bounded_and_preserve_aligned_bytes`
    moved out of the library unit tests into the integration test
    `crates/mokly-html/tests/source_map_corpus_tests.rs`, for the same
    rule. Its loader, `files` and `corpus` at lines 10-49, walks both
    fixture directories and repeats the `#data` and `#errors` reader of
    `html5lib_corpus_tests.rs`, without a count check.
- **Problem:** Two library unit tests read the vendored corpus from disk,
  against the rule for unit tests. Three tests now hold their own copy of
  the fixture paths, and two hold their own `.dat` reader.
- **Impact if no action:** The library unit-test binary depends on readable
  fixture directories in the checkout. A change to the fixture layout or
  the `.dat` reading needs edits in up to three places. The source-map test
  does not fail when a fixture file goes missing.
- **Root question:** How should the corpus tests load the vendored corpus,
  so that unit tests read no files and one helper reads each fixture
  format?
- **Options:**
  - **A.** Give the reference parser a test entry behind the existing `mock`
    feature of `mokly-html`, or a new test-support feature. Move both older
    tests to `crates/mokly-html/tests/`. Put one fixture loader in one shared
    module, for example `crates/mokly-html/tests/support/corpus.rs`. The
    loader holds the directory walk, the `.dat` reader, and the case counts.
    Use it in all three corpus tests. Keep every assertion, the counts 1796
    and 55, and the `insta` snapshots. Effort: Medium.
  - **B.** Keep the two older tests as unit tests. Embed the fixtures at
    compile time through a build script that lists the files. The
    integration test reads the same list. It needs a generated list, because
    a hand-kept list goes stale. Effort: Medium.
    - The CSS differential test of `mokly-css` had three hand-kept fixture
      lists.
    - Since PR #249 of 2026-10-30, the lists missed 11 of the 62 tracked
      stylesheets.
    - At `1b93c27f`, the lists missed 48 of the 99 tracked `.css` files.
    - Commit `9e57d861` replaced the lists with every stylesheet that Git
      lists.
  - **C.** Put only the loader into one shared file now. Include that file in
    the unit tests and the integration test with a `#[path]` module. It
    removes the copies of the reader. The unit tests still read files.
    Effort: Small.
- **Left out:**
  - Mock the file reads. The tests would check canned data instead of the
    vendored corpus.
  - An exception that lets unit tests read tracked fixtures. It breaks the
    `rust` skill rule, whose reason holds.
  - Delete the older corpus tests. They check the parser requirements of
    the HTML screens contract over the full corpus.
- **Wider fix:** The `rust` skill rule for unit tests and the `testing` skill
  rule for one file-format helper are in force, so no other wider fix.
- **Previous examples:**
  - Commit `02eec937` added both older tests.
  - `crates/mokly-cli/tests/static_output_tests.rs:68` reads the fixtures of
    another crate from an integration test.
  - Commit `9e57d861` moved the repository-stylesheet part of the CSS
    differential test of `mokly-css` into
    `crates/mokly-css/tests/token_differential_tests.rs`. Its
    generated-stylesheet test stays a unit test. A `test-support` feature
    makes one test entry public, `token_differential::first_difference`,
    which runs both section readers. That is the pattern of option A.
- **Recommendation:** A. It applies both rules: every corpus test becomes an
  integration test, and one loader serves all three.
- **Action:** fix after merge, apply A, because the two older tests came to
  `main` before the change that found them.
