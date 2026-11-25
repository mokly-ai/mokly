# Test runners repeat design screen lists and counts

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from the branch
  `conductor/storybook-support-a-mockups`. It is the wider fix that the branch
  split off its review finding 7 about stale test lists. Finding 9 repeated
  finding 7. The orchestrator of the Storybook support plan approved
  recording the item on 2026-11-19.
- **Location:**
  - `tests/fixtures/design/inventory.json:2`
  - `tests/fixtures/design/expectations.json:2`
  - `tests/helpers/design_catalogue_checks.ts:27`, line 215, and line 231
  - `tests/helpers/design_expectations.ts:91`
  - `tests/fixtures/design-library/browser-inventory.json`
  - `tests/fixtures/design-library/screens.json`
  - `tests/browser/design_catalogue.ts:13` and line 40
  - `tests/browser/design_library_inventory.ts:1`
  - `tests/browser/design_adoption.spec.ts:33`
  - `crates/mokly-cli/tests/design_behaviour/headings.rs:29` and line 39
  - `crates/mokly-cli/tests/design_behaviour/records.rs:26`
  - `crates/mokly-cli/tests/design_support/scopes.rs:39`, line 59, line 65,
    and line 72
  - `crates/mokly-cli/tests/design_support/matrix.rs:76`
  - `crates/mokly-cli/tests/design_support/snapshots/design_attribution_tests__design_support__matrix__top_bar_shared_rules.snap`
  - `crates/mokly-cli/tests/design_support/snapshots/design_attribution_tests__design_support__matrix__top_bar_implementation.snap`
- **Reason:** The fix reaches three test harnesses and serves every branch
  that adds a design screen, so one later branch does it for all.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Design entry:** a screen or a component of the example catalogue whose
    path starts with `design/`, written under `examples/basic/specs/design`.
  - **Variant parent:** the screen or component that a variant entry belongs
    to, in the catalogue field `variantOf`.
  - **Color schemes:** the schemes that an entry renders, light only or light
    and dark, in the catalogue field `colorSchemes`.
  - **Frozen list:** a committed list of expected design entries that a test
    compares with the built catalogue, so that an unplanned change fails.
  - **Comparison heading record:** the expected variant and change reasons of
    one component design page that shows a component comparison.
- **Background:**
  - Mokly's example catalogue under `examples/basic` holds design mockups of
    Mokly's own screens. Its design library holds the shared mockup
    components, under `design/library/`.
  - The 70 saved variants are the library components that have a variant
    parent. The top bar is the library component
    `design/library/chrome/top-bar`.
  - The protocol docs list the approved design entries, for example
    `docs/protocol/mokly-component-design-inventory.md` and
    `docs/protocol/mokly-shell-design-inventory.md`. No test reads these
    docs, because `AGENTS.md` forbids a test that asserts the words of a
    protocol page.
  - Three test runners check the built catalogue: the Node test runner,
    Playwright, and `cargo test`. The Node checks and the Playwright specs
    each keep a list of the design entries. The Rust tests read the Node list,
    and they keep their own counts, lists, and snapshots.
  - The Node test file `tests/design_catalogue.test.ts` uses these inputs. The
    Viewer CI job runs it:
    - `tests/fixtures/design/inventory.json` holds the design screen paths in
      `screens`, now 133. `inventoryViolations` in
      `tests/helpers/design_catalogue_checks.ts:27` compares the served design
      screens with them, path by path. The test "design screens match the
      frozen inventory in both viewports" runs it.
    - `inventory.json` also holds three reachability lists: `runtimeOnly`,
      `treeReached`, and `retries`. They name the screens that only a runtime
      transition or the catalogue tree reaches. They also name the failure
      states whose retry opens such a screen.
    - A `DUAL_SCHEME` pattern in `tests/helpers/design_expectations.ts:91`
      decides which entries render in both schemes. Every other design entry
      renders light only.
    - `sharedComponents` in `tests/fixtures/design/expectations.json` lists
      the saved variants of each of the 16 library components, in order. The
      test "shared components keep their pages, saved variants, and
      consumers" reads it.
    - `scopeViolations` in `design_catalogue_checks.ts` pins two counts at
      line 231, now `"56,20"`. They are the screens under `design/components/`
      and under `design/components/controls/`. It also pins the 70 saved
      variants at line 215. The test "shared design stylesheets keep their
      route scopes" runs it.
  - The Playwright specs use three lists:
    - `tests/fixtures/design-library/browser-inventory.json` holds a record for
      each design entry, now 218 records. Each record gives the kind of its
      entry, screen or component. It also gives the path, the color schemes,
      and the variant parent.
    - `designCatalogue` in `tests/browser/design_catalogue.ts` compares these
      records with the served catalogue at line 40. It runs in the setup of
      each spec.
    - The same records select the cases of the component design, design
      library, and comparison eligibility specs. These specs run on the served
      catalogue and on the static build.
    - `tests/fixtures/design-library/screens.json` holds a fixed set of 54
      screens. `tests/browser/design_adoption.spec.ts:33` pins that length.
    - `designLibrary` in `tests/browser/design_library_inventory.ts` lists the
      library components and their saved variants for the same spec.
  - The Rust tests live under `crates/mokly-cli/tests`:
    - `design_behaviour/headings.rs:39` pins the count of entries under
      `design/components/`, now 56. Line 29 pins the count of comparison
      heading records, now 9. The test is
      `design_comparison_headings_agree_with_recorded_changes` in
      `design_behaviour_tests.rs`.
    - Lines 21 to 35 of `design_behaviour/records.rs` hold a JavaScript page
      in a Rust string. The page writes the comparison heading records.
    - `records.rs:26` names, by state, the component design pages that show a
      comparison heading. The 9 records are these 7 pages and 2 controls pages
      that the page adds by name.
    - Line 97 of `headings.rs` compares the pages that show a comparison
      heading with the records.
    - `design_support/scopes.rs` loads `tests/fixtures/design/inventory.json`
      at lines 49 to 52. It compares the design screens with that list at
      line 59. Then line 65 pins the `design/components/` count again, now 56.
    - `scopes.rs:72` pins the 20 controls screens, and line 39 pins the 70
      saved variants.
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
    - The nightly workflow `.github/workflows/design-attribution.yml` runs
      `scopes.rs` and the two snapshots. They run in the test
      `design_catalogue_attribution_acceptance_matrix`, with the
      `design-matrix` feature.
    - The scheduled workflow runs on the default branch. Pull request CI does
      not run the test. The complete gate only lints it.
  - `tests/fixtures/design/adoption.json`, the adoption table, holds families
    and parts. A family is a group of design screens that one path pattern
    matches, such as `^design/changes/`.
  - Each part names a shared component and the family screens that show it.
    A part can instead name the family screens that leave the component out.
    The test "each design view records the shared components of its family"
    reads the table.
  - The adoption table and the list in `records.rs` record what a screen
    shows. A list of entries with kinds, color schemes, and variant parents
    does not hold that fact.
  - The commands, from the repository root:
    - `npm test -- tests/design_catalogue.test.ts` runs the Node checks. The
      npm commands build first.
    - `npm run test:browser -- {spec}` runs one browser spec, such as
      `tests/browser/component_design.spec.ts`.
    - `cargo test -p mokly-cli --test design_behaviour_tests` runs the Rust
      headings test.
    - `cargo test -p mokly-cli --features design-matrix --test design_attribution_tests`
      runs the nightly matrix.
    - The two Rust commands need `npm run build` first, because these tests
      render through the sidecar.
    - To update an `insta` snapshot, rerun its test with
      `INSTA_UPDATE=always`. Then read each changed `.snap` file, as
      `crates/mokly-html/README.md` says.
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
  - On 2026-11-19 a local run of the nightly test failed with
    `snapshot assertion for 'top_bar_shared_rules' failed in line 76`. That
    snapshot lacks the three new screens. The run stopped at the first
    failing snapshot.
  - The `top_bar_implementation` snapshot lacks them too. On 2026-11-19 both
    snapshots still wait for their update.
- **Problem:** The Node checks and the Playwright specs keep two separate
  lists of the design entries. The Rust tests read the Node list, but they
  pin their own counts and keep their own lists and snapshots. Each new,
  moved, or removed design screen must change these copies by hand.
- **Impact if no action:** Each branch that adds a design screen must find and
  edit up to nine test files in three runners. A missed copy fails CI. A
  missed copy in `scopes.rs` or a top bar snapshot fails only the nightly run
  after the merge.
- **Root question:** How does each test runner learn the approved design
  screens, so that it tests new screens and catches screens added or lost by
  mistake?
- **Options:** The letters follow the options of the review finding on the
  source branch. Its option B, a list for the Node and browser runners only,
  is under **Left out**. Its option C applied option A to the three new
  screens, and the branch chose C.
  - **A.** Keep the copies, and update each one for every new screen. Effort:
    Small for each screen, repeated.
  - **D.** Keep one committed list of design entries, with the kind, the color
    schemes, and the variant parent of each. The Node checks, the browser
    setup, and the Rust tests read it. `scopes.rs` already reads the Node list
    today. Each count comes from the list, or D removes it where an equality
    with the list already covers it. D deletes the browser inventory file.
    Effort: Medium.
    - D keeps the reachability lists of `inventory.json`, `sharedComponents`,
      the `DUAL_SCHEME` pattern, `screens.json`, and `designLibrary`.
    - After D, a new screen still changes the list and some other files:
      - `adoption.json`, when the screen is an exception to one of its parts
      - `records.rs` and `headings.rs:29`, when the screen shows a comparison
        heading
      - the two top bar snapshots, when the screen draws the top bar
      - the reachability lists, when only a runtime transition or the
        catalogue tree reaches the screen
      - `DUAL_SCHEME`, when the screen renders both schemes and the pattern
        misses its path
  - **E.** D, and a command that writes the list from a build. The author then
    reviews each change of the list as a snapshot. The author reads each
    changed value and accepts it on its own. CI never writes the list. E adds
    one more script. Effort: Medium.
  - **F.** Keep the copies, but remove the copied counts that an equality with
    the frozen list in the same test already covers. Effort: Small.
    - Only `scopes.rs:65` and line 72 qualify. They follow the equality at
      line 59.
    - The Node pin at `design_catalogue_checks.ts:231` and the count at
      `headings.rs:39` have no such equality in their test.
    - A count can go only when a named test covers the same check at the same
      level or lower. The author proves the cover: break the code once, and
      see the covering test fail.
    - The browser inventory stays a second copy.
- **Left out:**
  - A list that the tests take from the live catalogue: it passes when a
    screen is lost.
  - A generated browser inventory: it needs a drift check, which is a new
    gate.
  - One list for the Node checks and the browser setup only, which was option
    B of the review finding: D does the same and also covers the Rust counts.
  - A list that the tests parse from the protocol docs: `AGENTS.md` forbids a
    test that asserts the words of a protocol page.
- **Wider fix:** D. One list that every runner reads removes the screen lists
  and counts that go stale.
- **Previous examples:** On 2026-11-19, commit `3e09c615` on `main` added
  the saved variant `design/library/preview/device-frame/failed`. It updated
  the Node count to 70 and the browser inventory. It did not update
  `crates/mokly-cli/tests/design_support/scopes.rs:39`, which kept 69. So the
  nightly test failed at its first scope check, until the branch
  `conductor/storybook-support-a-mockups` set the count to 70 on 2026-11-23.
- **Related:** None open. The item `design-external-link-check.md`, which
  named `browser-inventory.json`, was fixed and deleted on 2026-11-25: the
  Node check `linkViolations` now rejects an unmarked external link in every
  served design view, so it does not depend on that file.
- **Recommendation:** D. One list replaces the separate screen lists and
  counts, so a new screen changes one list, not a copy in each runner.
- **Action:** fix after merge, apply D, because it reaches three test
  harnesses and serves every branch that adds a design screen.
