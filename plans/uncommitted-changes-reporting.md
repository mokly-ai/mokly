# Uncommitted Changes Reporting

Status: Active. Created 2026-10-05 with the user's consent. Milestones 1–4 are
complete; Milestone 5 records local verification, delivery and the post-push
review. The pull request merge completes this plan.

## Outcome

`mokly publish` uploads `mokly-upload.json`, whose `headSha` names the checked
out commit. The CLI permits uncommitted changes, so a receiver cannot tell
whether a publication shows its commit exactly. A receiver keeps the first
publication of each `headSha` and `configPath`, so one dirty local publish
blocks every later clean publish of that commit. Mokly Cloud also needs to know
when the newest upload of a branch is a dirty version of a commit.

This change reports the working-tree state in every publication. The upload
manifest becomes schema 2 with a required `uncommittedChanges` boolean, only
clean publications claim a commit, and the publish result tells the user when
a publication includes uncommitted changes. Nothing is live, so schema 1 is
removed rather than kept.

The normative requirements come from the user's brief (2026-10-05). Milestone 1
records them in the protocol documents so no later milestone needs the brief.
This is CLI, protocol, fixture, test and documentation work. It has no UI or
mockup work: the publish result is terminal output owned by the terminal
contracts. Mokly Cloud is not changed; after the release it pins the new
version and regenerates its contract fixtures from this repository's.

Contract owners:

- [Catalogue upload](../docs/protocol/mokly-upload.md) — manifest schema 2,
  detection and the publication rule.
- [Upload exchange](../docs/protocol/mokly-upload-exchange.md) — Plan and
  Complete replay rules.
- [Upload validation](../docs/protocol/mokly-upload-validation.md) — receiver
  validation of the manifest.
- [CLI terminal output](../docs/protocol/mokly-terminal-output.md) and
  [compatibility](../docs/protocol/mokly-terminal-errors.md) — the result line
  and the changed-state error.

## Scope And Decisions

- **Detection.** Publish runs Git with a fixed argument list and no shell:
  `git --no-optional-locks status --porcelain=v1 -z --untracked-files=all`
  followed by `--ignore-submodules=none --no-renames`. Porcelain paths are
  relative to the Git top level, so the check covers the whole repository even
  when the config lives in a subdirectory. Every record counts: modified,
  staged, deleted, renamed or type-changed tracked files, unmerged paths,
  submodule changes and untracked files that Git does not ignore. The fixed
  untracked and submodule options override `status.showUntrackedFiles`,
  `diff.ignoreSubmodules` and `submodule.<name>.ignore`. Ignored files never
  count. Output that Mokly cannot parse fails as `git-failed`.
- **Mokly working paths.** A path never counts when it is inside this run's
  export directory, the `.mokly-export-reservations` folder beside it,
  `.mokly-cache/` under `repoRoot`, the configured `review.outDir`, or a
  temporary folder whose name starts with `.mokly-write-` or `.mokly-review-`.
  Both the lexical and real forms of each folder are compared with the
  repository-relative paths. These folders never hold catalogue inputs, so
  excluding them cannot hide a change that reaches a publication.
- **Derived generated files.** In `generatedOutput: "derived"`, a file under
  `mockupsDir` that the build's generated ownership proof claims never counts.
  A derived export publishes compiled bytes, never these disk copies, and every
  export rewrites them. Without this rule the first CI publish of a derived
  catalogue that does not ignore every generated file would fail, and copied
  document resources cannot be ignored with one generic rule. Committed
  generated files still count, because Git holds them as content: a stale
  commit fails the recheck until `mokly build` output is committed. This goes
  beyond the brief's export folder and temporary files; it is the narrowest
  rule that stops the export from marking itself dirty.
- **Timing.** Publish reads the state immediately after HEAD, before export,
  and reads it again before Plan, after the existing changed-HEAD check. A
  different value fails as `git-failed` with
  `Uncommitted changes appeared or disappeared during export. Commit or ignore files that builds write, then publish again.`
  No new error code is needed: the changed-HEAD check already uses
  `git-failed` for the same class of failure. A failed status read is
  `git-failed` with
  `Git could not report uncommitted changes. Check the repository, then publish again.`
- **Manifest.** `mokly-upload.json` becomes `schemaVersion: 2` with a required
  `uncommittedChanges: boolean` after `headSha`. Readers accept only schema 2,
  check the version before other fields, and still reject missing, extra and
  duplicate fields. `headSha` keeps its meaning: the checked-out commit.
- **Publication rule.** A receiver keeps at most one clean publication for each
  `headSha` and `configPath`: the first clean publication that it completes. A
  publication with `uncommittedChanges: true` never claims that key and never
  replaces a clean publication. A later clean publication of a commit becomes
  the publication of that commit, also when dirty publications of it exist.
- **Replay.** A Plan or Complete joins an existing publication only when both
  have the same `uncommittedChanges` value. Only clean uploads join, because a
  dirty publication never holds the key: a clean upload of a published commit
  receives `missing: []` and Complete `200` with the kept clean publication,
  and every dirty upload that completes creates its own publication with
  `201`. Complete stays idempotent per upload id. The CLI treats `200` for a
  dirty upload as an invalid response (`upload-failed`), so it never reports a
  dirty upload as already published.
- **Fixtures.** A new `upload-manifest-v2.json` covers valid clean and dirty
  manifests and the version, missing-field, type and extra-field rejections.
  `upload-plan-v1.json` keeps the Plan response at v1, gains optional Complete
  case field `uncommittedChanges` (default `false`) with dirty `201` and `200`
  cases, and its fixture format becomes `schemaVersion: 2`. Both ship in the
  npm package, and the packed-consumer smoke reads them independently.
- **Result line.** A successful dirty publication adds the unstyled line
  `This publication includes uncommitted changes.` after the summary and before
  the viewer URL, identically in plain and rich output. Clean output is
  unchanged.
- **GitHub Action.** The action guide states that build steps which leave
  untracked files that Git does not ignore mark the publication as having
  uncommitted changes, and that `.gitignore` prevents this.
- **Release.** The implementation commit is `feat(publish)!:` with a
  `BREAKING CHANGE:` footer. Release Please owns `CHANGELOG.md` and versions; the
  open Release Please pull request takes the next minor version, `0.14.0`. A
  person must merge this pull request and then the release pull request; that
  merge publishes to npm.

## Milestone 1: Define the contract

Record the complete detection, manifest, receiver, replay and output contract
before changing code. Guides describe implemented behaviour, so they change with
the implementation in Milestone 4.

- [x] Specify schema 2, `uncommittedChanges`, detection, Mokly working paths,
      timing, errors and the publication rule in `mokly-upload.md`.
- [x] Update the Plan and Complete replay rules and the fixture description in
      `mokly-upload-exchange.md`.
- [x] Update receiver validation and the version table in
      `mokly-upload-validation.md`.
- [x] Update the manifest example in `mokly-export-ownership.md` and the
      uncommitted-input wording in `mokly-publication-changes.md`.
- [x] Add the result line and the changed-state copy to the terminal output
      and compatibility contracts.
- [x] Update the protocol index and the breaking-change release note.
- [x] Validate the changed Markdown and inspect the documentation diff.

## Milestone 2: Detect the state and write manifest schema 2

Report the working-tree state in every manifest and fail when it changes during
export.

- [x] Add failure-first tests for every detection case: a clean checkout, a
      changed tracked file, a staged change, a deleted file, an untracked file,
      an ignored file, an untracked file only in the output directory and the
      other Mokly working paths, a submodule change, and
      `status.showUntrackedFiles=no`.
- [x] Add parser tests for renamed, unmerged and nested-repository records and
      for malformed output.
- [x] Implement the fixed-argument status reader and the working-path
      exclusions in `src/publish`, reusing the reservation and temporary-folder
      names that the exporter and build already own.
- [x] Resolve the state with HEAD before export, write it into the manifest,
      and recheck it before Plan; test a change made during export in both
      directions.
- [x] Make the manifest validator check the version first and require the
      boolean field; add `upload-manifest-v2.json` and test the validator
      against it, including rejection of version 1 and of a missing field.
- [x] Move every existing manifest literal, helper and expectation to schema 2.
- [x] Split `tests/guides_ci.test.ts` by topic, with shared document reads in a
      helper, so every changed test file stays within the 300-line limit.
- [x] Rebuild and commit generated output in the committed-mode delta receiver
      test, as a committed catalogue's workflow requires; the export otherwise
      rewrites stale committed files and correctly fails the recheck.

## Milestone 3: Keep clean and dirty publications apart

Implement the receiver rule in every repository receiver and make the CLI
reject a dirty `200`.

- [x] Reject Complete `200` for a dirty upload in the CLI and add the dirty
      Complete cases to `upload-plan-v1.json`.
- [x] Apply the clean-only key, Plan join and Complete rules in the test
      receiver and its independent manifest validator.
- [x] Test a clean replay of a clean publication and no replay between clean
      and dirty publications in both orders, plus repeated dirty uploads.
- [x] Update the packed-consumer smoke receiver, fixture reader and package
      file list for both fixtures.

## Milestone 4: Tell the user

Show the state in the publish result and document the behaviour for users.

- [x] Add the result line in plain and rich output and test both.
- [x] Test end-to-end publishes with the repository's test receiver for a clean
      tree and for a dirty tree.
- [x] Update the publish, upload, CI and GitHub Action guides, the action
      README and the affected source READMEs.

## Milestone 5: Verify and deliver

Prove the complete gate, smoke-test the command and deliver a merge-ready pull
request without applying review findings automatically.

- [x] Smoke-test `mokly publish` against a local receiver for a clean and a
      dirty checkout in plain and rich output.
- [ ] Run `cargo xtask check` and require a 100% pass rate.
- [x] Inspect the final diff, deletions against `origin/main` and whitespace.
- [ ] Run `git add -A`, commit the completed work with a Conventional Commit and
      `BREAKING CHANGE:` footer, push the branch with every new file tracked,
      and open the pull request.
- [ ] After the push, review the complete diff against `origin/main` using
      `docs/implementation-review-prompt.md`; report numbered findings with
      severity, impact, lettered solution options and a recommendation without
      changing the implementation.

Verification evidence: before the rebase onto `60d48370`, the complete gate
passed the repository, package, unit (4,247 of 4,247) and hydration (263 of 263) suites. The packed ESM consumer publishes a dirty and then a clean
checkout. The browser suite passed 839 of 844 tests. The five failures are all
in `tests/browser/preview_design_links.spec.ts`: its shared `ordinaryPreview`
fixture exceeded its fixed 300-second setup timeout, because this sandbox needs
about 289 seconds for that preview build. The same fixture also times out on
unmodified `origin/main` here, and both preview spec files pass when they run
alone on this branch (14 of 14). After the rebase, which brought only
documentation changes, the repository and package suites pass again. The unit
suite passes 4,246 of 4,247: the 2,500 ms bound in
`tests/postcss_dependency_review.test.ts` measured 2,779 ms. On this sandbox
that test measures 2,153–2,999 ms with this branch and 2,906–2,965 ms with
`origin/main`'s code, so the failure depends on load, not on this change. The
complete gate therefore stays open until hosted CI runs it.

## Post-merge follow-up (non-blocking)

- Merge the Release Please pull request that includes this change to publish
  the next minor version to npm.
- Mokly Cloud pins that version in a separate change and regenerates its
  contract fixtures from `upload-manifest-v2.json` and `upload-plan-v1.json`.
