# Review Fix Follow-ups

Status: Completed. [PR #70](https://github.com/mokly-ai/mokly/pull/70)
merged on 2026-09-15. The four findings of its review, recorded below, await
the user's decision.

## Summary

Address the four findings from the
[derived baseline review fixes](./derived-baseline-review-fixes.md) review,
using the recommended option for each. Backend and tooling only; no mockup or
UI work.

Protocol owner: [package and authoring contract](../docs/protocol/mokly-package.md)
for the `repoRoot` rule; [derived baselines](../docs/protocol/mokly-derived-baselines.md)
for the rebuild post-steps.

## Milestone 1: Validate the Git top level at config resolution — completed

- [x] In config resolution, run `git rev-parse --show-toplevel` from
      `repoRoot` and fail with a typed config error when its projected real
      path differs from `repoRoot`. Apply to every command that reads Git;
      `build` and `check` without comparisons must keep working outside a Git
      repository, so the check runs where a repository is first required, not
      at `defineConfig` load for those commands. Remove the duplicate check
      from `prepareReviewRepository`.
- [x] Rewrite the test named "changed routes require the config repo root to
      be the Git top level" so its fixture has a manifest and it asserts the
      typed error code from a nested `repoRoot`; add the same assertion for
      the unselected comparison route in a committed-mode child.
- [x] Document the rule in `mokly-package.md` under `repoRoot` and remove
      the comparison-specific wording from the derived baselines doc.
- [x] Apply the same config-owned guard to derived tracking checks, pinned and
      selected readers, classification and reference polling; retain All when
      optional history is unavailable and test standalone build/check without Git.

## Milestone 2: Preserve the original error in every rebuild post-step — completed

- [x] In `src/baseline/rebuild.ts`, wrap the `removePartialBaseline` call in
      the `finally` with the same catch-and-report pattern as lock release, so
      a failed removal never replaces the in-flight typed error.
- [x] Add a parameterised case to `tests/baseline_cleanup.test.ts` that fails
      `remove` during a failed build and asserts `baseline-command-failed`
      survives with its diagnostics.

## Milestone 3: Inject the maintenance reporter — completed

- [x] Add a `BaselineMaintenanceReporter` interface in
      `src/baseline/maintenance.ts` with a stderr implementation, inject it
      into `CachedBaselineBuilder` as a fourth collaborator, and default it at
      the composition root in `src/review/prepare.ts`.
- [x] Replace the `process.stderr.write` monkey-patching in
      `tests/baseline_cleanup.test.ts` with an injected fake reporter.
- [x] Update `src/baseline/README.md`.

## Milestone 4: Cleanup and import ordering — completed

- [x] Delete the `const client = git` alias in `src/server/changed.ts`.
- [x] Add an ESLint import-order rule to `eslint.config.js` matching the
      existing convention (Node builtins, external packages, then relative
      imports, alphabetised within groups) and fix every file it reports.
- [x] Use the ESLint 10-compatible `eslint-plugin-import-x` implementation of
      `import/order`; upstream `eslint-plugin-import` only declares support
      through ESLint 9. Verify that the bulk fix preserves code outside imports.
- [x] Run format, lint, typecheck, `npm test`, `npm run example:check`,
      browser tests, `cargo xtask check`; commit and push.

## Milestone 5: Review — completed

- [x] After the final push, review the complete local diff against
      `origin/main` using `docs/implementation-review-prompt.md`. Report
      numbered findings with severity, context, impact, lettered options and a
      recommendation. Do not change the implementation.

Review outcome: four findings were reported to the user without changes (one
medium, three low). The medium finding is that the import-order rule's parent
path group does not match parents two or more levels up, so the bulk fix
placed sibling imports above deep parent imports in fifteen files, contrary
to the documented convention. Each finding is awaiting the user's decision.
