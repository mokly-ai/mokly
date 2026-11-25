# CI tests only one supported Vite version

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 40.
- **Location:** `packages/mokly/package.json:53`,
  `scripts/release/manifest.mjs:231`, `package-lock.json:25623`,
  `.github/workflows/ci.yml:145`, and the section "Loading Vite" of
  `docs/protocol/mokly-vite-adapter.md`.
- **Reason:** The floor test adds a second Vite to the lockfile, and the
  newest end needs the user's choice between a release smoke and a scheduled
  job.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Peer range:** The versions of `vite` that `@mokly/mokly` names in its
    optional peer dependency, `^8.0.0`.
  - **Floor:** The oldest version of the peer range, Vite 8.0.0.
  - **Newest end:** The newest published Vite release inside the peer range.
  - **Release smoke:** The release check in
    `scripts/release/smoke_consumer.mjs` that installs the packed archives in
    a new consumer.
- **Background:**
  - Mokly ships no Vite. It loads the project's own Vite, because the
    plugins of the setup must run in that Vite. The section "Loading Vite" of
    `docs/protocol/mokly-vite-adapter.md` says that the optional peer
    dependency names the supported range and that CI tests that range.
  - An orchestrator design call of 2026-11-18 says the same, and it says that
    Mokly adds no version check. The protocol also rejects a version check,
    because it adds a new error.
  - CI installs Vite 8.3.8 from the one workspace lockfile, at
    `package-lock.json:25623`. The runtime matrix at
    `.github/workflows/ci.yml:145` varies Node only. The release check at
    `scripts/release/manifest.mjs:231` only compares the declared range with
    a second literal.
  - The guide `docs/guides/authoring/vite.md:15` tells users to install
    `vite@^8`, which gives the newest Vite 8. No workflow moves the lockfile
    past 8.3.8. The daily dependency audit updates only packages with
    advisories, so it does not move Vite.
  - The adapter uses `fetchModule` and `config.createResolver`. Vite 8.3.8
    marks them `@experimental` and `@deprecated`, at
    `node_modules/vite/dist/node/index.d.ts:3832` and line 3734.
  - `hook()` at `packages/mokly/src/sidecar/vite-css-hooks.ts:146` returns
    with no error when Vite lacks its internal `vite:css` or `vite:css-post`
    plugin. CSS Module elements then render without classes. So a version
    test must check the output, not only a compile.
  - The Node tests that install packages use `--offline`, as
    `tests/helpers/base_manager_tools.ts:74` shows. The repository already
    installs pnpm 11 and 12 through npm aliases in the one lockfile, at
    `package.json:102`.
  - The release smoke installs no Vite, at
    `scripts/release/smoke_consumer.mjs:26`.
  - No record shows that the current code passes at Vite 8.0.0.
  - The user excluded a new CI job in a similar case for older Git. See
    `plans/follow-ups/older-git-compatibility-ci.md`.
- **Problem:** CI tests only Vite 8.3.8. A code change that stops loading
  Vite 8.0.x still passes the Vite tests. No test runs a Vite 8 release that
  is newer than the lockfile either.
- **Impact if no action:** Mokly can ship a release that installs with a
  declared supported Vite version and fails at compile time.
- **Root question:** How does Mokly keep its declared Vite versions equal to
  the versions that CI shows to work, at both ends of the range?
- **Options:**
  - **A.** Run the Vite compile and replay smoke tests against the declared
    floor in an isolated consumer fixture, inside the existing verification
    suite. Keep the current workspace run. Effort: Medium.
  - **B.** Limit the declared range to the versions that the project tests.
    Update the peer declaration, the release check, and the published
    documentation together. This reduces consumer compatibility. A cap at the
    newest tested minor, such as `~8.3.0`, is a form of B. npm can then
    refuse an install with a peer conflict for each newer Vite 8. Effort:
    Medium.
  - **C.** Add Vite version profiles for the adapter integration suite. This
    covers more adapter behaviour, but it adds a new CI gate. Effort: Large.
  - **D.** Test the floor through an npm alias in the workspace lockfile, as
    the repository does for pnpm 11 and 12:
    - Add a root development dependency such as
      `"vite-floor": "npm:vite@8.0.0"`.
    - Link it as `vite` in a per-test `node_modules`, as
      `tests/fixtures/vite_node_peers.ts` builds one.
    - Run these adapter tests a second time: config loading, the module
      runner, the CSS hooks, and the stylesheet resolver. Pick only tests
      whose result depends on Vite APIs or internals.
    - Check the output, not only a compile.
    - Add one assertion that ties the alias version to the floor of the
      declared range.
    - Cost: a second Vite and its Rolldown binary in the lockfile, and a
      longer viewer suite.
    - Risk: `@vitejs/plugin-react` imports `vite` from its real path and gets
      8.3.8. So a floor fixture must not link a third-party Vite plugin from
      the workspace.
    - Effort: Medium.
  - **E.** Add a Vite build to the release smoke:
    - Install the declared floor in the smoke consumer, then the newest
      release of the range.
    - For each version, run `mokly build` with `"vite": true` on a fixture
      with a CSS Module and a stylesheet URL.
    - Check the class names and the asset route in the output.
    - This tests the packed package as a new user installs it.
    - Cost: it runs only at release time and needs the registry. A break
      blocks a release, not a pull request. It makes the release check
      stricter, so the user must approve it.
    - Effort: Medium.
  - **F.** Test the newest Vite 8 on a schedule:
    - In the daily `dependency-audit.yml` workflow, install the newest
      release of the declared range, and run the Vite adapter tests.
    - Report a failure in the existing dependency update pull request or in
      an issue.
    - This finds a break soon after Vite publishes it, and it blocks no pull
      request.
    - Cost: it adds a scheduled job. The user excluded a new CI job in the
      similar Git case.
    - Effort: Medium.
- **Left out:**
  - Assert the version string of the workflow. It fails the goal, because it
    cannot detect a sidecar or loader regression. The `testing` skill also
    never tests workflow YAML literals.
  - Add a runtime version check. It verifies no version, and the protocol
    and the design call of 2026-11-18 reject it.
  - A one-time check at Vite 8.0.0 as the fix. It cannot catch a later
    change. Run it once as the first step of A, B, or D, because no record
    shows that the current code passes at 8.0.0.
  - Drop the claim that CI tests the range, and keep `^8.0.0`. It fails the
    goal, because a release can still fail with a declared version.
  - Join Vite's ecosystem CI. It depends on the Vite team, and it tests
    unreleased Vite code, not the published range.
- **Wider fix:** D, built as one peer-range helper. The supported Storybook
  range needs the same CI test later, and it can reuse the helper. C
  prevents the class only if its profiles read the declared range and the
  registry at run time. As written, C uses fixed profiles. E or F still
  covers the newest end.
- **Previous examples:** `plans/follow-ups/older-git-compatibility-ci.md`
  records a similar gap between the versions that users run and the
  versions in CI.
- **Related:**
  - `plans/follow-ups/vite-setup-error-location.md`: its setup errors end
    with `Vite {version}; tested range {range}`, and this item decides
    whether that text is true. Its regression test must not hard-code the
    range.
  - The fixes of these items reason from the code of Vite 8.3.8, and some of
    their options hook Vite internals. Put their regressions in the floor
    run of D too:
    `plans/follow-ups/vite-sass-outside-root-reads.md`,
    `plans/follow-ups/vite-renderer-pruning-css-modules.md`,
    `plans/follow-ups/vite-composed-stylesheet-assets.md`,
    `plans/follow-ups/vite-nested-css-url-escapes.md`,
    `plans/follow-ups/vite-plugin-report-hook-order.md`, and
    `plans/follow-ups/vite-config-modules-own-url.md`.
- **Design call:** D for the floor. The working agent of the branch that
  found this item chose it on 2026-11-25. It waits until after the merge,
  because it adds a second Vite to the lockfile. D adds no CI job and no
  gate, so it needs no answer. A branch can apply D before the user answers
  the question of the newest end.
- **Recommendation:** D for the floor, and E or F for the newest end. D is A
  with an offline install path, output checks, no new CI job, and a declared
  floor that cannot drift from the tested floor.
- **Action:** ask the user, because no option for the newest end is clearly
  best: E makes the release check stricter, and F adds a scheduled job.
