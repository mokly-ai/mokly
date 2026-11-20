# Static evidence test flakes with hidden Details text

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from PR #356 on the branch
  `calummoore/mokly-git-command-wait-kvvh`, during CI run 44620542813 on
  commit `759f86e58`.
- **Location:** `tests/browser/static_workspace_evidence.spec.ts:55`, the
  visibility assertion of the helper `expectChangedComponent` at lines 45-56.
  Line 93 calls the helper in the host URL form tests at lines 72-95. The
  fixture is `tests/browser/comparison_test.ts:19-25`. The shared readiness
  helper that the spec does not call is
  `tests/browser/comparison_ui.ts:147-167`.
- **Reason:** The pull request changes only Git command code under
  `crates/mokly-git`, and this unchanged flaky browser test needs its own
  reproduction before any fix.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Inspector:** the tab strip below the preview in the Browse shell, with
    Details, Props, Usage, and sometimes Components. Only the open tab's
    panel is visible.
  - **Copied comparison fixture:** a read-only static comparison build that
    the browser suite makes once. `tests/browser/comparison_test.ts` opens it
    through a static host, with no Serve endpoint.
  - **Affected consumer link:** a link in the Usage panel of a changed
    component to a screen that uses it. Its address selects the recorded
    instance of that component.
  - **Host URL form:** one of the three addresses of one route that a static
    host can serve: extensionless, with a trailing slash, or with
    `/index.html`.
- **Background:**
  - Mokly builds static mockup catalogues and shows them in the Browse shell.
    For a branch, it can build a comparison with the branch point on `main`.
  - In a comparison, the Details panel of an entry lists the comparison
    evidence. `packages/ui/src/comparison-evidence/comparison-evidence.tsx:150-157`
    renders each changed component as one paragraph in the section marked
    `data-workspace-evidence`.
  - In the copied comparison fixture, "Changed screen" uses the changed
    component Card. So the Details of "Changed screen" show "Changed
    component: Card".
  - `tests/browser/static_workspace_evidence.spec.ts` has four tests. One test
    reaches "Changed screen" through the navigation list. Three tests load
    Card at one host URL form each, then click the affected consumer link
    "Changed screen" in Usage.
  - The trailing-slash test loads the canonical address with no redirect. In
    the extensionless and `/index.html` tests, the host answers the canonical
    address with a redirect to that form.
  - After the link click, `expectChangedComponent` waits for the heading
    "Changed screen", clicks the Details tab, and expects the evidence line to
    be visible.
  - The helper does not call `awaitRoutedDetail` from
    `tests/browser/comparison_ui.ts`, which waits until the routed entry's
    detail settles.
  - `playwright.config.ts` sets no retries and a 10-second assertion timeout.
    The 10-second wait in the failure is that existing timeout.
  - A click on a closed inspector tab opens its panel. A click on the open tab
    closes the inspector, from `packages/ui/src/inspector/inspector.tsx:132-135`.
  - On 2026-11-19, the test failed in CI run 44620542813 on commit
    `759f86e58`. Its full title is
    `chromium › static_workspace_evidence.spec.ts › a destination's evidence opens at host URL form /`.
  - The job was "Browser (Node 22.15.0, shard 4/4)". It ran
    `cargo xtask check --suite browser --shard 4/4` with one Playwright worker
    on the GitHub `ubuntu-24.04` runner image. 628 tests passed, and this test
    failed.
  - The failure text, copied without timestamps:

    ```text
    Error: expect(locator).toBeVisible() failed

    Locator:  locator('[data-workspace-evidence]').getByText('Changed component: Card', { exact: true })
    Expected: visible
    Received: hidden
    Timeout:  10000ms

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for locator('[data-workspace-evidence]').getByText('Changed component: Card', { exact: true })
        23 × locator resolved to <p class="mbk-reset">…</p>
           - unexpected value "hidden"

    ✖ chromium › static_workspace_evidence.spec.ts › a destination's evidence opens at host URL form /
        at expectChangedComponent (/home/runner/work/mokly/mokly/tests/browser/static_workspace_evidence.spec.ts:55:5)
        at /home/runner/work/mokly/mokly/tests/browser/static_workspace_evidence.spec.ts:93:5
    ```

  - Each logged locator resolution found the hidden evidence paragraph.
    The assertion exhausted its 10-second guard. The earlier heading check
    and Details click passed.
  - In the same job, the extensionless and `/index.html` tests passed. The
    navigation-list test of the same spec passed too. Every other job of the
    run passed, including the macOS and Windows jobs.
  - The same test passed in the earlier full browser CI run 44617201041 on
    commit `bb16efe3d`. That commit held the same pull request change.
  - Between `bb16efe3d` and `759f86e58`, no file changed under `packages/`,
    `tests/browser/`, `tests/helpers/`, or `scripts/verification/`. The file
    `playwright.config.ts` did not change either.
  - The `main` commits merged between them changed Rust install-process code
    and tests under `crates/mokly-compare`, `crates/mokly-cli`, and
    `crates/mokly-platform`, one protocol page, and follow-up items.
  - The pull request changes only Git command code and tests under
    `crates/mokly-git`, its README, `docs/protocol/mokly-git.md`, and one
    follow-up item. No assertion, timeout, retry, fixture, or product source
    of this flow changed after the failure.
  - **Rerun outcome:** the unchanged test passed in the fresh CI run
    44624319908 on commit `7e6e12f01`. Its job "Browser (Node 22.15.0, shard
    4/4)" passed, and all four browser shards passed.
  - No manual rerun of the failed job was needed.
  - Between `759f86e58` and `7e6e12f01`, no file changed under `packages/`,
    `tests/browser/`, `tests/helpers/`, or `scripts/verification/`. The file
    `playwright.config.ts` did not change either.
  - The only changes between them were a Rust CLI test, one protocol page,
    and two follow-up items. So the spec, the UI, the viewer, and the browser
    harness were the same in the failed run and in the passed run.
  - No controlled reproduction has identified the cause. The cause is unknown.
  - Suspected source, a hypothesis only: a race between the test's Details
    click and the shell's panel selection or navigation readiness.
  - The facts behind the hypothesis: the affected consumer link builds its
    address with `usageHref` in
    `packages/viewer/src/shell/workspace_usage.tsx:23-35`, which adds the
    recorded instance.
  - When a routed instance resolves,
    `packages/viewer/src/shell/workspace_instance_selection.ts:55-63` opens
    the Props tab. A protocol rule requires this for a Used by link, at
    `docs/protocol/mokly-component-explorer.md:154-155`.
  - If Props opens after the Details click, the Details panel is hidden.
    Nobody saw this order in a trace.
  - No product regression is proven. The pull request touches none of this
    code, the same change passed before, and the sibling tests passed.
  - The failure also does not prove the shell free of a defect, because the
    suspected race includes shell code.
- **Problem:** An unchanged browser test failed once in the required CI gate,
  then passed in a fresh run with no change to it. In the failure, the line
  "Changed component: Card" stayed hidden after the Details click for the full
  10-second guard. No controlled reproduction has identified its cause.
- **Impact if no action:** A required browser job can fail on a correct
  change, and each failure costs a rerun. If the source is in the shell,
  readers can meet the same hidden panel.
- **Root question:** How can this test check the destination's Details
  evidence deterministically, with every assertion kept?
- **Options:**
  - **A.** Reproduce the failure and name its source. Then make this test
    wait for the explicit state that the source names before it clicks
    Details. Keep every assertion. If the source is in product code, add a
    failing test first, then fix that code. Add no retry, sleep, repeat, skip,
    or longer time limit to the test. The unknown cause requires a separate
    investigation. Effort: Medium.
    - Run the unchanged test many times with a trace, alone and in the CI
      shard that holds it:

      ```sh
      npm run build
      npx playwright test tests/browser/static_workspace_evidence.spec.ts -g "host URL form /" --repeat-each=50 --trace=on
      cargo xtask check --suite browser --shard 4/4
      ```

    - At a failure, record the open tab, the open state of the inspector, the
      route, and the selected instance.
  - **B.** After A names the source, give that state a fixed order or isolate
    it in one shared place. For a test-timing source, put the readiness wait
    in one navigation helper in `tests/browser/comparison_ui.ts`. Each
    comparison spec that clicks an inspector tab after a client navigation
    then uses that helper. Keep every assertion. Effort: Medium.
- **Left out:**
  - Change nothing and rerun failed jobs. It fails the goal, because the
    required gate can still fail on a correct change.
  - A retry, a sleep, a longer time limit, a skip, a quarantine, or a weaker
    assertion. Each hides the failure, and the flaky-test rule of the
    `testing` skill forbids it.
  - Remove the test. It fails the goal, because it drops assertions.
  - A fix before a reproduction names the source. It can miss the cause, or
    change behaviour that needs no change.
  - Only two options stay, because each other approach fails the goal or
    breaks the testing rules.
- **Wider fix:** B. One shared ordering or isolation step prevents the same
  race in every comparison spec that acts after a client navigation, once A
  confirms the source.
- **Previous examples:** None found for this test or this failure text.
  `awaitRoutedDetail` in `tests/browser/comparison_ui.ts:147-167` is a related
  readiness wait. Its comment says that the head names the routed entry before
  the detail load settles. Many comparison specs call it, but this spec does
  not. `plans/follow-ups/flaky-component-design-removed-preview.md` records
  another visibility failure after a navigation click. Its source is also
  unconfirmed, so it shows no shared cause.
- **Recommendation:** A. Name the source before any wider change, because a
  fix without a named source can hide the real cause. B best protects the
  codebase once A confirms the source.
- **Action:** ask the user, because the source is unknown and no reproduction
  names it, so no option is clearly best yet.

History: CI run https://github.com/mokly-ai/mokly/actions/runs/44620542813 of
pull request https://github.com/mokly-ai/mokly/pull/356.
