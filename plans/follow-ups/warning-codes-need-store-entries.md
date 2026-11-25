# New warning codes need their own store entry

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, finding 15 of round 2.
  It is the wider fix that the agent split off. Option B here is option D of
  its finding check.
- **Location:**
  - `crates/mokly-graph/src/document_store_metadata.rs:77-93`: `warning_code`,
    the list of the warning codes that the render store can keep. `:96-123`:
    `StoredWarning::encode` and `StoredWarning::restore`, which pass each code
    through that list. `:172-193`: `StoredMetadata::new`, which gives no
    stored record for a document with a code outside the list.
  - `crates/mokly-catalogue/src/diagnostic.rs`: `Warning`, whose `code` field
    is a `&'static str`, and `STORY_RENDER_FAILED`.
  - The warning producers in `crates/mokly-catalogue`, `crates/mokly-html`,
    `crates/mokly-render`, `crates/mokly-graph`, `crates/mokly-compare`, and
    `crates/mokly-cli`.
  - The code comparisons, such as `crates/mokly-cli/src/build.rs:128`, which
    leaves `base-dependencies` out of `--strict`.
  - `crates/mokly-graph/src/_tests_/document_persistence_tests.rs`: the disk
    round-trip test of stored document records.
- **Reason:** The direct fix adds a round-trip case for the story warning, and
  a shared code type reaches the warning producers of six crates outside the
  diff of the branch that found it.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Render store:** the disk cache that lets a later Serve process reuse a
    rendered document, under `docs/protocol/mokly-render-store.md`.
  - **Warning code:** the stable name of a build warning, such as
    `story-render-failed`, which the table of section "Record" of
    `docs/protocol/mokly-build-warnings.md` lists.
  - **Store list:** `warning_code`, the list of the codes that the render
    store can keep.
- **Background:**
  - Section "Stored Documents" of `docs/protocol/mokly-render-store.md` says
    that a stored document keeps its exact bytes and every record that a
    fresh render keeps with it. Its build warnings are one of these records.
  - `Warning` holds its code as a `&'static str`. Each producer writes its
    code as a string literal. Only `story-render-failed` has a constant,
    `STORY_RENDER_FAILED`.
  - The store writes each code as text. The store list turns the text back
    into a `&'static str`. The list holds 12 codes, and each new code needs
    its own entry.
  - When a document carries a code outside the store list, the store keeps
    no record of the document. Serve then renders the document again after
    each restart. No warning and no test reports the lost record.
  - Track F of the Storybook support plan added the `story-render-failed`
    warning of a failed story view, and its entry in the store list. Section
    "The Warning" of `docs/protocol/mokly-storybook-failures.md` says that a
    reused document keeps its warning.
  - The review of 2026-11-25 found no test of that entry. The story test
    checked reuse from memory only. The disk round-trip test
    `persistent_records_restore_all_metadata_and_exact_bytes` used only
    `html-foster-parented`. A removed entry passed both tests, and the store
    then kept no failed story document.
  - The review fix of the same day adds a `story-render-failed` warning, with
    a route subject and a literal message, to the input of that round-trip
    test. The test catches the loss of this one entry only.
- **Problem:** Each new warning code needs a second entry in the store list,
  and nothing ties the two together. A code without its entry makes the store
  drop each document that carries it, without a warning.
- **Impact if no action:** A later warning code can make Serve render its
  documents again after every restart, and nobody notices until a restart is
  measured. Each new producer adds one more string literal that a shared type
  must convert later.
- **Root question:** How can the render store keep each warning code that a
  producer can write, with no second list to update?
- **Options:**
  - **A.** Define each code once as a constant in
    `crates/mokly-catalogue/src/diagnostic.rs`, with one slice of all codes.
    The store looks the text up in that slice. `Warning` keeps its
    `&'static str`, so a producer can still write a code that the slice
    lacks. Effort: Small.
  - **B.** Give `Warning` an owned code text in place of the `&'static str`.
    The store then keeps each code with no list. A misspelt code then reaches
    the terminal, the store, and the code comparisons with no error. Effort:
    Medium.
  - **C.** Give the warning producers and the store one shared warning-code
    type, an enum in `crates/mokly-catalogue/src/diagnostic.rs`, with the
    existing stored spellings. The store writes and reads that type, so a new
    code needs no separate store entry, and the records in existing stores
    stay readable. Keep a round-trip regression case. Effort: Medium.
- **Left out:**
  - A test that compares the store list with the code table of
    `docs/protocol/mokly-build-warnings.md`: the repository rules forbid a
    test that reads the words of a protocol page.
  - Change nothing: each new code repeats the risk, and only its own test
    case catches a missing entry.
- **Wider fix:** C. The compiler then checks the code of each producer, and the
  store follows the type with no list of its own.
- **Previous examples:**
  - The missing round-trip case of `story-render-failed`, above.
  - Commit `104123bb7`, "perf(serve): reuse rendered documents after a
    restart (#394)", added the render store and its round-trip test of
    document records.
- **Recommendation:** C. One type removes the second list, and the compiler
  rejects a misspelt code. B also removes the list, but each code stays free
  text. A misspelt code then passes the compiler, the store, and the code
  comparisons, such as the `--strict` filter of `base-dependencies`.
- **Action:** fix after merge, apply C, because a shared warning-code type
  reaches the warning producers of six crates outside the diff of the branch
  that found it.
