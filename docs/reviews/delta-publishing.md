# Delta Publishing Review

Fifteen findings: five Medium and ten Low. None is a security leak or data
loss in the shipped CLI, and none was changed during the review. Each finding
awaits the user's decision; see [the plan](../../plans/delta-publishing.md).

Background for readers new to the feature: `mokly publish` exports a static
catalogue, then sends it to a receiver (for example Mokly Cloud) in three
steps. **Plan** posts a small archive holding the upload manifest
(`mokly-upload.json`), the ownership marker (`.mokly-export-artifact`, which
lists every exported file with its SHA-256 digest and size) and, with
comparisons, the review file. The receiver answers with the digests it does
not hold. **Blobs** uploads those files one request each. **Complete** asks
the receiver to publish. The marker's format is "schema 2".

## Findings

1. **P2 / Medium — Export now fails on some file names it used to accept,
   without naming the file.** The schema 2 marker builder rejects paths with
   control characters, invalid Unicode or more than 1,024 UTF-8 bytes
   ([`src/export/ownership.ts`](../../src/export/ownership.ts), lines 40–47),
   but the inventory every file enters first (`src/export/path_index.ts`)
   still accepts them. On `origin/main` only `publish` rejected such paths;
   `export` succeeded. A reviewer reproduced it end to end: macOS writes an
   invisible `Icon\r` file into folders with custom icons, and a mockups
   folder holding one now fails with "The export contains a file path that is
   not portable", which names no file.
   [Export step 5](../protocol/mokly-export.md#generation-lifecycle) documents
   only the 64 MiB limit, and only that limit has an export-level test. The
   same path grammar now exists in three copies (`ownership.ts`,
   `src/publish/validation.ts`, `scripts/package/ownership.mjs`).
   **Impact of no change:** affected users cannot export or publish and cannot
   find the offending, often invisible, file.
   **Options:** **A)** name the path in the message, escaped with
   `JSON.stringify`, document the rules in export step 5 and the export
   guide, and add export-level tests; **B)** do A and enforce one shared
   portability predicate where files enter the inventory, reused by the
   marker builder, parser and upload validation; **C)** skip non-portable
   public files with a warning. **Recommended: B.** One rule at the entry
   point with a test per rejected shape prevents the three copies drifting;
   C silently drops content.

2. **P2 / Medium — A repeated Complete for the same upload is unspecified,
   and the test receiver breaks "keep the first publication".** The CLI
   retries Complete after a lost response, and the
   [upload contract](../protocol/mokly-upload.md#complete) calls Complete
   idempotent, but it only defines `201` (new publication) and `200` (the
   receiver already had one for this commit and config path). The fake
   receiver decides "already published" at plan time
   ([`tests/helpers/fake_receiver.ts`](../../tests/helpers/fake_receiver.ts),
   lines 157, 176 and 231–253): a probe that dropped the first `201` response
   saw the CLI retry, get `201` again and create `publication-2`, replacing
   `publication-1`; two overlapping uploads also both published. A receiver
   that follows the `200` wording literally would instead make the CLI print
   "already published for this commit" for the publication it had just
   created. **Impact of no change:** Mokly Cloud implements from this
   document, so a lost response yields duplicate publications or a
   misleading message, and the tests cannot catch either.
   **Options:** **A)** specify that repeating Complete for one upload returns
   its first result and never creates another publication, reserve `200` for
   a publication completed by a different upload, add a fixture case, fix the
   fake to decide at Complete time and remember completed uploads, and add
   lost-response and overlapping-upload tests; **B)** specify that a repeat
   returns `200` and accept the message; **C)** leave it unspecified.
   **Recommended: A.**

3. **P2 / Medium — The success line's counts are misleading.** In the
   plain line
   `Published Mokly catalogue. <uploaded> files uploaded, <unchanged> unchanged.`
   ([`src/cli/publish_output.ts`](../../src/cli/publish_output.ts)),
   `<uploaded>` counts marker paths whose content went up as a blob
   ([`src/publish/run.ts`](../../src/publish/run.ts), lines 216–222), so the
   plan-archive files, which are sent on every run and never requested as
   blobs, always count as "unchanged": a first publish to an empty receiver
   prints "47 files uploaded, 1 unchanged" (the plan's own recorded smoke
   output). The progress label counts distinct contents while the summary
   counts paths, so the same run shows "Uploading 44 of 44 files" then "47
   files uploaded". A blob stored by the receiver whose response was lost is
   not counted if a re-plan follows. The terminal contract says "requested",
   the upload contract says "uploaded". **Impact of no change:** every
   publish headline is wrong by one or two, and the plain line is the
   automation contract, so the error freezes once `0.13.0` ships.
   **Options:** **A)** one shared counting module where a file means a marker
   path, plan-archive paths count as uploaded, a content's paths count once
   its PUT is first attempted, and both progress and summary read from it,
   with both documents, the guides and tests aligned; **B)** rename
   "unchanged" to "already stored" and leave plan-archive files out of both
   numbers; **C)** document the behaviour only. **Recommended: A,** as a
   module rather than more logic in `run.ts` (see finding 14), with a
   first-publish test asserting `0 unchanged` and a shared-digest test that
   progress and summary agree.

4. **P2 / Medium — Two contract rules pass their tests even when the CLI
   breaks them.** The plan fixture's `missing-content-type` case is built as
   `new Response(string)`, and the Fetch API then adds
   `text/plain;charset=UTF-8`, so the "header absent" case repeats the
   non-JSON case ([`tests/upload_plan_contract.test.ts`](../../tests/upload_plan_contract.test.ts),
   lines 47–60). "Redirects are never followed" is asserted for plan and blob
   requests but not for Complete, and the fake receiver cannot send a
   `Location` header. A reviewer's mutations (accepting a missing content
   type; switching Complete to `redirect: "follow"`) passed every related
   test; in follow mode fetch re-sends the bearer to a same-origin `Location`
   and reports that target's `201` as success. **Impact of no change:** a
   regression in either rule ships unnoticed while the case names suggest
   coverage. **Options:** **A)** send fixture bodies as bytes and assert
   `redirect` in the Complete tests; **B)** do A, let fake-receiver overrides
   carry headers, make the `302` cases send a same-origin `Location` and
   assert it is never requested, and check each built response matches the
   fixture's declared status and content type; **C)** additionally share one
   request-init assertion across every plan, blob and Complete mock.
   **Recommended: B, with C if cheap:** the test setup cannot express
   header-level cases, so fix the setup rather than two tests.

5. **P2 / Medium — Every publish re-uploads every page shell.** The upload
   manifest, which carries `headSha` and `exportedAt`, is an input to the
   deployment identity, and that identity is stamped into every page shell
   (`index.html`, `404.html`, `view/*`, `id/*/index.html`) and
   `__mokly/catalogue.json` ([`src/publish/run.ts`](../../src/publish/run.ts),
   lines 88–121; [`src/export/deployment.ts`](../../src/export/deployment.ts)).
   A reviewer exported the same catalogue three times with only those two
   manifest fields changed: 10 of 48 digests changed each time, and
   `tests/publish_receiver_delta.test.ts` expects every shell after a
   one-screen change. Comparison exports change shells whenever the review
   changes anyway, but a `--no-changes` publish of an unchanged catalogue (a
   typical main-branch CI publish) still re-uploads roughly two shells per
   entry. **Impact of no change:** the delta exchange's main saving is lost
   for unchanged catalogues; large catalogues re-send megabytes each run.
   **Options:** **A)** exclude `mokly-upload.json` from the identity input, as
   the marker already is, keep it in the marker, and update the delivery and
   upload documents; **B)** document the expected upload volume; **C)** as a
   separate plan, stamp the identity only into the shared catalogue JSON so
   shells stop depending on the whole artifact. **Recommended: A now, C as a
   follow-up plan** if large catalogues need further savings.

6. **P3 / Low — Rich progress leaves stale characters when the label
   shrinks.** The in-place redraw writes `\r<label>` without erasing the line
   ([`src/cli/reporter/rich_phase.ts`](../../src/cli/reporter/rich_phase.ts),
   lines 81–89). Labels only grew before; after a re-plan they shrink, and an
   emulated terminal showed `Uploading catalogue…iles · 1.1 MiB…` until the
   phase ended. **Impact of no change:** garbled output during 409, 410 and
   expiry recovery. **Options:** **A)** write `\r\x1b[2K` before every frame,
   as `clear()` already does, test a long-then-short label with carriage
   return and erase emulated, and state it in the terminal contract;
   **B)** pad to the previous visible width. **Recommended: A.**

7. **P3 / Low — The guides misstate the retry schedule.** The code and
   protocol make at most five attempts (four retries) with jitter caps of 1,
   2, 4 and 8 seconds ([`src/publish/retry.ts`](../../src/publish/retry.ts)),
   but [`cli/publish.md`](../guides/cli/publish.md) line 75 says "retried up
   to five times" and [`ci/the-upload.md`](../guides/ci/the-upload.md) line
   103 says "at most sixteen seconds"; the protocol's `min(16 s, …)` cap can
   never be reached. `tests/guides_ci.test.ts` compares documents only.
   **Impact of no change:** receiver authors size quotas and expiry from a
   schedule twice as long as the real one. **Options:** **A)** reword to
   "tried up to five times" and "at most eight seconds" and drop the dead
   cap; **B)** move to six attempts so sixteen seconds is real; **C)** with A
   or B, export the schedule constants and check the guides against them, as
   the test already does for the 120 s timeout. **Recommended: A plus C.**

8. **P3 / Low — Result and cancellation copy.** Counts are never
   pluralised ("1 files uploaded", "Uploading 0 of 1 files"). Pressing
   Ctrl+C during the upload prints "The catalogue could not be uploaded.
   Check the endpoint and connection, then retry." (`src/publish/http.ts`,
   `src/publish/retry.ts`), and rich mode repeats that sentence as its hint;
   `origin/main` said the upload "failed or was interrupted". **Impact of no
   change:** an ungrammatical headline, and users who cancelled are told to
   check their network. **Options:** **A)** pluralise in the contract and
   code through one shared helper (Serve already pluralises inline), give
   cancellation its own fixed `upload-failed` message and drop the repeated
   hint; **B)** keep the current strings. **Recommended: A.**

9. **P3 / Low — The protocol documents contradict each other on two
   receiver rules.** The upload contract maps every exceeded limit to `413`
   and says limits are checked before structure (lines 221 and 327), while
   the ownership contract and its fixture classify an over-limit `size` or
   path as invalid, `400` or `422`
   ([`mokly-export-ownership.md`](../protocol/mokly-export-ownership.md),
   line 102). The upload contract answers `missing` from blobs "held by a
   publication of the same project" (line 346), while the guides, the re-plan
   flow and the fake receiver count any blob already stored for the project;
   a receiver reading line 346 literally re-requests every blob after a 409
   or 410. `mokly-upload.md` is also 364 lines against the ~250-line guidance.
   **Impact of no change:** receivers built from different sections return
   different categories or never resume. **Options:** **A)** pick one status
   per case, align both documents, the fixture (for example a `too-large`
   rejection class) and the fake, and reword line 346 to "stored for the same
   project"; **B)** do A, add a test cross-checking the fixture's rejection
   classes against the status table, and split the upload document.
   **Recommended: B.**

10. **P3 / Low — The ownership fixture leaves path-grammar edges undefined.**
    "Control characters" is undefined: the CLI rejects Unicode category Cc
    but accepts format characters such as U+200D and U+202E. The only length
    case is 1,025 ASCII characters, which a character-counting reader also
    passes, and no case sits exactly at 1,024 bytes. File/directory prefix
    collisions are called invalid, but both readers accept `a` beside `a/b`.
    The independent package reader mirrors the production parser line for
    line, so the fixture is the only independent check. **Impact of no
    change:** a receiver that rejects format characters passes all 46 cases
    yet rejects exports with an emoji joiner in a file name. **Options:**
    **A)** define control characters as category Cc and add DEL, U+0085,
    accepted U+200D, multi-byte over-limit and exactly-1,024-byte cases and
    the version-type precedence; **B)** do A and add prefix-collision cases,
    classified as marker-shape or whole-artifact failures.
    **Recommended: B** (documents and fixtures only).

11. **P3 / Low — The stale schema 1 message tells users to delete the whole
    folder.** A folder holding an export from an earlier release now fails
    with "This export was created by an unsupported Mokly version. Remove
    `<dir>` before exporting again."
    ([`src/export/ownership.ts`](../../src/export/ownership.ts), line 228),
    checked before the unowned-files check, so hand-added hosting files such
    as `CNAME` are deleted by users who follow it. "Unsupported" also
    misdescribes an earlier release. **Options:** **A)** reword to "This
    folder holds an export from an earlier Mokly release. Move any files you
    added, then delete `<dir>` and export again." and assert it in
    `tests/export_paths.test.ts`; **B)** read the old list only to report
    unowned files first; **C)** leave it. **Recommended: A.**

12. **P3 / Low — `blob:` URLs pass the same-origin check.** Plan validation
    compares `URL.origin` ([`src/publish/plan.ts`](../../src/publish/plan.ts),
    lines 161 and 173, mirrored in `scripts/package/upload_plan.mjs`), and
    `blob:https://api.example.com/…` reports the inner origin. Node refuses
    the request locally, so the token never leaves, but the CLI treats it as
    a network failure and runs the whole retry schedule. **Options:** **A)**
    one shared helper comparing protocol, hostname and port and allowing only
    http(s), used by both validators, with fixture cases; **B)** add a
    protocol comparison beside the origin check. **Recommended: A.**

13. **P3 / Low — Watch's export-ownership lookup is about 3.5 times slower.**
    The watcher's ignore check re-reads and fully validates the marker for
    every path ([`src/export/ignored.ts`](../../src/export/ignored.ts)), and
    schema 2 entries are nearly three times larger: a watcher over a
    2,000-file export became ready in 30.5 s against 9.0 s on `origin/main`.
    `readMarker` skips markers over 8 MiB, about 43,000 schema 2 entries,
    though writers allow 64 MiB. It only matters when an export sits under a
    watched root outside `.context`, as broad `watch.rules` allow. **Options:**
    **A)** cache the parsed marker per path by inode, size and mtime as sets
    of paths and directory prefixes; **B)** raise the read cap to 64 MiB
    with A; **C)** leave it. **Recommended: A+B,** with a test counting
    parses through an injected reader rather than timing them.

14. **P3 / Low — `src/publish/run.ts` is at the size cap and helpers are
    duplicated.** It is 296 lines against the 300-line cap and holds
    orchestration, the plan/blob/complete loop and snapshot validation;
    `mediaType` and `record` are copied in `plan.ts` and `complete.ts`,
    `retry.ts` duplicates `uploadFailed()`, and there are three
    `invalidBundle` helpers. **Impact of no change:** findings 3 and 8 break
    the cap or need edits in several places. **Options:** **A)** split out
    snapshot and exchange modules, move response helpers into `http.ts` and
    error factories into one module; **B)** leave it. **Recommended: A.**

15. **P3 / Low — The release depends on an undocumented squash-merge title.**
    `main` squash-merges pull requests, so release-please reads the pull
    request title, not implementation commit `52ca854`. A multi-commit pull
    request defaults to the branch name ("Calummoore/bogota v7"), which
    release-please skips, so no `0.13.0` release or CHANGELOG entry would be
    produced. The plan also named a 51-character title that `AGENTS.md`
    forbids; the commit used `feat(publish)!: upload catalogue content deltas`.
    **Options:** **A)** record in the plan that the pull request must be
    squash-merged under that title with the `BREAKING CHANGE:` footer kept;
    **B)** do A and add a CI check that pull request titles are Conventional
    Commits of at most 50 characters. **Recommended: B,** which protects
    every future plan.

## Scope And Delivery

Reviewed on 2026-09-26 with
[the implementation review prompt](../implementation-review-prompt.md), after
implementation commit `52ca854` was pushed to `calummoore/bogota-v7`. The
baseline was `origin/main` at `3699c56`. The complete diff covers the plan,
the contract commits and the implementation: 99 files (31 added, 67 modified,
one deleted: `docs/protocol/fixtures/export-ownership-v1.json`, approved by
the plan), 7,816 insertions and 994 deletions. The working tree was clean at
review start.

Three independent read-only reviewers covered export ownership and deployment
identity; the publish exchange and CLI output; and tests, fixtures, packaging
and documentation. They used code reading, focused tests against the built
`dist/`, mutations of copies of `dist/` and probes under `/tmp`. The lead
reproduced the evidence for findings 2, 4, 6 and 12 and checked the others'
code paths. No implementation, test or generated file was changed.

## Verification

`cargo xtask check` passed on the committed tree with Node 24.21.0:
dependency audit (0 vulnerabilities), Prettier, ESLint, Rust formatting and
Clippy, 10 Rust tests, the file-length audit, typechecks, example check,
package check and packed-consumer smoke, 2,461 of 2,461 unit tests across 458
files and 781 of 781 browser tests across 122 files, with nothing skipped or
cancelled. Reviewers' focused reruns passed: 61 tests across 13 files, 42
publish unit tests and the export ownership, paths and watch suites.

Residual test risk: no terminal-emulated rich rendering test, no lost-response
tests, no check that progress and summary agree, no export-level test of the
path rules or the 64 MiB marker ceiling, and guide tests that compare
documents with each other rather than with the code.
