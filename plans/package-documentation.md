# Package Documentation

Ship Mokly's CLI documentation as plain Markdown in the published
`@mokly/mokly` package so the private `mokly-cloud` repository can render the
documentation for each installed release. This plan supersedes the unmerged
public-site plan and pull request #79 without merging that branch or bringing
the Astro site into this repository.

The source corpus is pinned to commit
`6ee1427ebc4c7bf3511c4b7f4c67b7d10dc92b3b` on
`calummoore/mogadishu-v5`. Files are copied from that commit individually; the
branch is never merged or rebased. The five guide sections use the new contract's
explicit reading order: Getting started, Authoring, Catalogue, Continuous
integration, then CLI reference. That order intentionally takes precedence over
the old site's placement of CLI before CI.

No screen, visual design, or runtime UI changes are involved, so this plan has
no mockup or UI milestone. The Astro site, site workflows and scripts, Folio
tokens, site mockups, Lighthouse tooling, Astro-only formatting/tooling changes,
and every other excluded file from pull request #79 remain out of scope.

## Milestone 1: Define the packaged-guides contract

Document the complete source, routing, publication, versioning, and ownership
boundary before copying or packaging the guides.

- [x] Add `docs/protocol/mokly-guides.md` with the five section ids, titles,
      one-line summaries, reading order, and the
      `docs/guides/<section>/<slug>.md` source-to-route convention.
- [x] Define the exact four-field frontmatter grammar and validation rules:
      `title`, a 1-to-180-character `description`, a directory-matching
      `section`, and a positive section-unique `order`; reserve `status: ahead`
      for cloud-owned pages and reject it here.
- [x] Define the CommonMark body profile, GitHub tables, language-labelled
      fenced blocks, heading rules, HTML/JSX/import/component exclusions, and
      the current absence of authored guide links.
- [x] Define future guide links, published-reference links, site routes, and
      absolute URLs; record the six protocol source-to-slug mappings and the
      released-tag fallback for other relative protocol links.
- [x] Define literal package-version ownership, the two Release Please marker
      files, package publication/version semantics, and the present-tense copy
      rules retained from the old site-docs contract.
- [x] Index the new contract from `docs/protocol/README.md` and align
      `docs/protocol/npm-release.md`, `docs/protocol/mokly-package.md`, and the
      root `README.md` with the package/cloud ownership split.
- [x] Port only the requested independent documentation fixes from the pinned
      source: the fenced export-generation path, the shell-inventory wording
      without its public-site reference, and the `brace-expansion` 5.0.12 line.
- [x] Validate the changed Markdown, local links, and diff, then run
      `cargo xtask check` so the milestone leaves the repository gate green.

Verification: Prettier and `git diff --check` passed for the changed Markdown.
`cargo xtask check` passed 1,754 Node tests, all five packed-consumer scenarios,
418 Chromium tests, and all Rust formatting, Clippy, unit-test, and file-length
checks. No test failed, retried, or was skipped.

## Milestone 2: Convert and verify the guide corpus

Copy the 30 approved pages mechanically into the repository and make their
plain-Markdown contract executable in the root test suite.

- [x] Copy the pinned `start` (5), `authoring` (9), `catalogue` (5), `ci` (5),
      and `cli` (6) MDX pages to matching `.md` paths under `docs/guides/`,
      preserving frontmatter, order, headings, examples, and prose.
- [x] Replace `<Install />` with the unpinned `shell` install block, replace
      `<Install pinned />` with the pinned `@mokly/mokly@0.10.0` install block,
      and replace `<Version />` with the literal `0.10.0`; place the required
      Release Please comments outside the affected fenced blocks and prose.
- [x] Check every copied command, option, config field, error category, public
      export, and described behavior against the current 0.10.0 implementation;
      change prose only when an alignment test demonstrates a mismatch.
- [x] Add root `tests/guides_*.test.ts` coverage for the exact 30-page
      inventory, restricted frontmatter, section/order uniqueness, description
      bounds, Markdown/headings/fences, forbidden syntax, and the allowed link
      grammar for current and future links.
- [x] Add a version regression that discovers every guide semver literal,
      requires it to equal the root package version, and checks the two
      release-managed marker regions.
- [x] Rework the pinned CLI, CI, authoring, and copy tests to read
      `docs/guides/` directly and run through the existing root `npm test`
      command with no new parser or test dependency.
- [x] Run the focused guide tests and the complete `npm test` suite, format and
      lint the new sources, then run `cargo xtask check` so the milestone leaves
      the repository gate green.

Verification: All 19 focused guide tests passed. The complete root suite passed
1,773 tests with no failures, skips, retries, or cancellations. After fixing a
strict TypeScript guard in the new link test, `cargo xtask check` passed
formatting, lint, typechecking, the same 1,773 Node tests, all five packed
consumer scenarios, 418 Chromium tests, and all Rust formatting, Clippy, unit
test, and file-length checks.

## Milestone 3: Wire publication and release updates

Make the verified guides part of the package and keep their embedded versions
in lockstep with future root releases.

- [x] Add `docs/guides` beside `docs/protocol` in the root package `files`
      allowlist and update package-manifest, archive-inventory, bootstrap, and
      release fixtures to require guides while continuing to reject tests,
      plans, examples, and unrelated repository files.
- [x] Add root-package Release Please `generic` extra-file entries for
      `docs/guides/start/install.md` and `docs/guides/ci/github-action.md`, and
      extend release configuration tests to pin that contract without changing
      the viewer release component.
- [x] Port the requested `scripts/package/archive.mjs` runtime-license hunk from
      the pinned source while preserving the current viewer-workspace behavior,
      and cover any changed behavior at the archive/license boundary.
- [x] Mark the guides contract as implemented once its source, tests, package
      allowlist, and release wiring are all present.
- [x] Run the focused package, archive, and release tests plus `npm test`, then
      run `cargo xtask check` so the milestone leaves the repository gate green.

Verification: Lint, strict typechecking, 19 guide tests, 38 focused package,
archive, release, and bootstrap tests, the real dry-run inventory, and
`package:check` passed. The complete root suite passed 1,775 tests with no
failures, skips, retries, or cancellations. `cargo xtask check` then passed the
dependency audit, formatting, lint, typechecking, the same 1,775 Node tests, all
five packed consumer scenarios, 418 Chromium tests, and all Rust formatting,
Clippy, unit-test, and file-length checks.

## Milestone 4: Prove and deliver the package

Exercise the exact artifact, hand it off in a new pull request, and leave review
findings for the user rather than changing the reviewed implementation.

- [x] Run `npm pack` into an isolated `.context` directory, list the tarball,
      and assert that all 30 files under `docs/guides/` and the protocol
      documents are present while tests, plans, examples, site files, and other
      excluded paths are absent.
- [x] Smoke-test the packed package's CLI/version and readable documentation
      from a clean temporary consumer, then run the relevant focused tests,
      the full test suite, and a final `cargo xtask check` with a 100% pass rate.
- [x] Inspect the complete diff and deletion list against `origin/main`, verify
      that no mainline feature or excluded pull-request #79 material was removed
      or imported, and update this plan's completed TODOs and verification notes.

Verification before delivery: The isolated `npm pack` artifact contains all 30
guide files and all 54 protocol files, while `tests`, `plans`, `examples`, and
`site` are absent. A clean consumer installed that exact tarball, reported CLI
version 0.10.0, read both guide and protocol documentation, and imported all 16
public exports. The post-pack focused suite passed 57 tests and `package:check`;
the complete root suite passed 1,775 tests with no failures, skips, retries, or
cancellations. The final `cargo xtask check` passed the dependency audit,
formatting, lint, typechecking, those 1,775 Node tests, all five packed consumer
scenarios, 418 Chromium tests, and all Rust checks. The diff has no deletions and
contains none of the excluded site, Folio, Lighthouse, Astro-tooling, site-test,
or site-mockup material from pull request #79.

- [x] After all checks pass, run `git add -A`, commit with Conventional Commit
      title `feat(docs): ship CLI guides in package`, push the current branch,
      open a pull request with that title against `main`, then comment on and
      close #79 unmerged with a link to the replacement pull request; keep its
      branch intact.

Delivery: commit `61d0322` is pushed on `calummoore/houston-v5`; replacement
pull request #82 is open against `main`. Pull request #79 was linked to #82 and
closed with no merge, and its `calummoore/mogadishu-v5` branch remains intact.

- [ ] After the push, use `docs/implementation-review-prompt.md` to review the
      complete local diff against `origin/main` without changing files; report
      every finding with a number, severity, context, impact, lettered solution
      options, and a recommended scope, or state clearly that there are no
      findings and identify residual test risk.
