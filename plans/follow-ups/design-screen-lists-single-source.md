# Three test runners copy the design screen list

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch
  `conductor/storybook-support-a-mockups`. It is the wider fix that the branch
  split off its review finding 7 about stale test lists. Finding 9 repeated
  finding 7. The orchestrator of the Storybook support plan approved the item
  on 2026-11-19.
- **Location:** `tests/fixtures/design/inventory.json:2`,
  `tests/fixtures/design/expectations.json:2`,
  `tests/helpers/design_catalogue_checks.ts:27`, line 215, and line 231,
  `tests/helpers/design_expectations.ts:91`,
  `tests/fixtures/design-library/browser-inventory.json`,
  `tests/browser/design_catalogue.ts:13` and line 40,
  `crates/mokly-cli/tests/design_behaviour/headings.rs:29` and line 39,
  `crates/mokly-cli/tests/design_behaviour/records.rs:26`,
  `crates/mokly-cli/tests/design_support/scopes.rs:39`, line 59, line 65, and
  line 72, `crates/mokly-cli/tests/design_support/matrix.rs:76`,
  `crates/mokly-cli/tests/design_support/snapshots/design_attribution_tests__design_support__matrix__top_bar_shared_rules.snap`,
  and
  `crates/mokly-cli/tests/design_support/snapshots/design_attribution_tests__design_support__matrix__top_bar_implementation.snap`.
- **Reason:** The fix reaches three test harnesses and serves every branch
  that adds a design screen, so one later branch does it for all.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Design entry:** a screen or a component of the example catalogue whose
    path starts with `design/`, written under `examples/basic/specs/design`.
  - **Variant parent:** the screen or component that a variant entry belongs
    to, in the catalogue field `variantOf`.
  - **Saved variant:** a design library component under `design/library/`
    that has a variant parent.
  - **Color schemes:** the schemes that an entry renders, light only or light
    and dark, in the catalogue field `colorSchemes`.
  - **Frozen list:** a committed list of expected design entries that a test
    compares with the built catalogue, so that an unplanned change fails.
- **Background:**
  - Mokly's example catalogue under `examples/basic` holds design mockups of
    Mokly's own screens. Its design library holds the shared mockup
    components, under `design/library/`.
  - The protocol docs list the approved design entries, for example
    `docs/protocol/mokly-component-design-inventory.md` and
    `docs/protocol/mokly-shell-design-inventory.md`. No test reads these
    docs, because `AGENTS.md` forbids a test that asserts the words of a
    protocol page.
  - Three test runners check the built catalogue: the Node test runner,
    Playwright, and `cargo test`. Each runner keeps its own copy of the design
    entries.
  - The Node test file `tests/design_catalogue.test.ts` uses these copies. The
    Viewer CI job runs it:
    - `tests/fixtures/design/inventory.json` holds the design screen paths in
      `screens`, now 133. `inventoryViolations` in
      `tests/helpers/design_catalogue_checks.ts:27` compares the served design
      screens with them, path by path. The test "design screens match the
      frozen inventory in both viewports" runs it.
    - A `DUAL_SCHEME` pattern in `tests/helpers/design_expectations.ts:91`
      decides which entries render in both schemes. Every other design entry
      renders light only.
    - `sharedComponents` in `tests/fixtures/design/expectations.json` lists
      the saved variants of each of the 16 design library components. The
      test "shared components keep their pages, saved variants, and
      consumers" reads it.
    - `scopeViolations` in `design_catalogue_checks.ts` pins two counts at
      line 231, now `"56,20"`. They are the screens under `design/components/`
      and under `design/components/controls/`. The test "shared design
      stylesheets keep their route scopes" runs it.
    - `scopeViolations` also pins the 69 saved variants at line 215.
  - The Playwright specs use one browser copy:
    - `tests/fixtures/design-library/browser-inventory.json` holds a record for
      each design entry, now 218 records. Each record gives the kind, the
      path, the color schemes, and the variant parent of its entry.
    - `designCatalogue` in `tests/browser/design_catalogue.ts` compares these
      records with the served catalogue at line 40. It runs in the setup of
      each spec.
    - The same records select the cases of the component design, design
      library, and comparison eligibility specs. These specs run on the served
      catalogue and on the static build.
  - The Rust tests keep their copies under `crates/mokly-cli/tests`:
    - `design_behaviour/headings.rs:39` pins the count of entries under
      `design/components/`, now 56. Line 29 pins the count of comparison
      heading records, now 9. The test is
      `design_comparison_headings_agree_with_recorded_changes` in
      `design_behaviour_tests.rs`.
    - `design_behaviour/records.rs:26` lists, by state name, the component
      design pages that show a comparison heading. The 9 records are these 7
      pages and 2 controls pages that the file adds by name. Line 97 of
      `headings.rs` compares the pages that show a comparison heading with the
      records.
    - `design_support/scopes.rs:59` compares the design screens with
      `tests/fixtures/design/inventory.json`. Then line 65 pins the
      `design/components/` count again, now 56. Line 72 pins the 20 controls
      screens, and line 39 pins the 69 saved variants.
    - Two `insta` snapshots in `design_support/snapshots/` list the design
      screens that draw the top bar. They hold lines such as
      `design/library/chrome/top-bar -> design/components/states/removed`.
      The two snapshots hold the same lines:
      - `design_attribution_tests__design_support__matrix__top_bar_shared_rules.snap`
      - `design_attribution_tests__design_support__matrix__top_bar_implementation.snap`
    - Every design screen draws the top bar, except the three startup pages
      under `design/browse/loading/`.
    - `design_support/matrix.rs:76` asserts both snapshots. The test asserts
      `top_bar_shared_rules` first, so a failure there hides the second
      snapshot.
    - Only the nightly workflow `.github/workflows/design-attribution.yml` runs
      `scopes.rs` and the two snapshots. They run in the test
      `design_catalogue_attribution_acceptance_matrix`, with the
      `design-matrix` feature. Pull request CI does not run them. The complete
      gate only lints that test.
  - `tests/fixtures/design/adoption.json`, the adoption table, names the
    screens that show a shared component when only some screens of a family
    show it. It can also name the screens that leave the component out. The
    test "each design view records the shared components of its family" reads
    it.
  - The adoption table and the list in `records.rs` record what a screen
    shows. A list of entries with kinds, color schemes, and variant parents
    does not hold that fact.
  - On 2026-11-18 the branch `conductor/storybook-support-a-mockups` added
    three design screens: `design/components/states/stories/story-failed`,
    `design/components/states/stories/story-failed-changes`, and
    `design/components/states/stories/storybook-link`.
  - The three screens need edits in nine test files across three runners:
    `inventory.json`, `adoption.json`, `browser-inventory.json`,
    `design_catalogue_checks.ts`, `headings.rs`, `records.rs`, `scopes.rs`,
    and the two top bar snapshots.
  - Before the edits, every CI verification job failed:
    - The Repository job and the two Native jobs failed on the Rust count. The
      test `design_comparison_headings_agree_with_recorded_changes` panicked
      at `headings.rs:39` with `left: 56` and `right: 53`.
    - The Viewer job failed in the Node test "shared design stylesheets keep
      their route scopes" with `scopes pin 56, 20`.
    - The Static delivery job and the four Browser shards failed on the
      browser inventory equality. The file held 215 records, and the served
      catalogue had 218 design entries.
  - On 2026-11-19 a run of the nightly test
    `design_catalogue_attribution_acceptance_matrix` failed with
    `snapshot assertion for 'top_bar_shared_rules' failed in line 76`. That
    snapshot lacks the three new screens.
  - The `top_bar_implementation` snapshot lacks them too. On 2026-11-19 both
    snapshots still wait for their update.
- **Problem:** Three test runners keep their own copies of the design entries
  and of their counts. Each new, moved, or removed design screen must change
  every copy by hand.
- **Impact if no action:** Each branch that adds a design screen must find and
  edit up to nine test files in three runners. A missed copy fails CI, or only
  the nightly run when the copy is in `scopes.rs` or a top bar snapshot.
- **Root question:** How does each test runner learn the approved design
  screens, so that it tests new screens and catches screens added or lost by
  mistake?
- **Options:** The letters keep those of the review finding. Its option C was
  option A for the three new screens, and its branch chose C.
  - **A.** Keep the copies, and update each one for every new screen. Effort:
    Small for each screen, repeated.
  - **D.** Keep one committed list of design entries, with the kind, the color
    schemes, and the variant parent of each. The Node checks, the browser
    setup, and the Rust tests read it. Each count comes from the list, or D
    removes it where an equality with the list already covers it. D deletes
    the browser inventory file. Effort: Medium.
  - **E.** D, and a command that writes the list from a build, so that the
    author reviews each change of the list as a snapshot. It adds one more
    script, and the snapshot rules of the `testing` skill apply. Effort:
    Medium.
  - **F.** Keep the copies, but remove the copied counts that an equality with
    the frozen list in the same test already covers. For example, the
    equality at `scopes.rs:59` covers the counts at line 65 and line 72. F
    relies on the removal rule of the `testing` skill. The browser inventory
    stays a second copy. Effort: Small.
- **Left out:**
  - A list that the tests take from the live catalogue: it passes when a
    screen is lost.
  - A generated browser inventory: it needs a drift check, which is a new
    gate.
  - One list for the Node checks and the browser setup only, which was option
    B of the review finding: D does the same and also covers the Rust tests.
  - A list that the tests parse from the protocol docs: `AGENTS.md` forbids a
    test that asserts the words of a protocol page.
- **Wider fix:** D. One list that every runner reads removes the copies that
  go stale.
- **Previous examples:** None found.
- **Recommendation:** D. One list removes every hand-kept copy, so a new
  screen changes one list, not a copy in each runner.
- **Action:** fix after merge, apply D, because it reaches three test
  harnesses and serves every branch that adds a design screen.
