# Delta Publishing Review

Fifteen findings: five Medium and ten Low. None is a security leak or data
loss in the shipped CLI, and none was changed during the read-only review. The
user then approved every recommended option; all fifteen are fixed, and their
original analysis is preserved below. See **Approved Follow-up** for the
changes and [the plan](../../plans/delta-publishing.md) for the milestones.

Background for readers new to the feature: `mokly publish` exports a static
catalogue, then sends it to a receiver (for example Mokly Cloud) in three
steps. **Plan** posts a small archive holding the upload manifest
(`mokly-upload.json`), the ownership marker (`.mokly-export-artifact`, which
lists every exported file with its SHA-256 digest and size) and, with
comparisons, the review file. The receiver answers with the digests it does
not hold. **Blobs** uploads those files one request each. **Complete** asks
the receiver to publish. The marker's format is "schema 2".

## Initial Findings — addressed

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
   [exchange contract](../protocol/mokly-upload-exchange.md#complete) calls Complete
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

## Approved Follow-up

On 2026-09-26 the user approved fixing every finding with its recommended
option. [Delta Publishing](../../plans/delta-publishing.md) Milestones 7–13
record the decisions and work; each item below links a finding to its fix.

1. **Addressed.** One portability rule (`src/export/portable_path.ts`) runs
   where every file enters the export inventory and is reused by the marker
   builder, the marker parser and upload path validation. The export error
   names the path escaped with `JSON.stringify`, so every control character
   appears as an escape sequence; the rule is documented in the export and
   ownership contracts and guides, with export-level tests for every rejected
   shape.
2. **Addressed.** The exchange contract makes Complete idempotent per upload
   and reserves `200` for a publication completed by a different upload,
   resolved before the stored-digest check. The fake receiver decides at
   Complete time, replays a completed upload's first status and body, and can
   drop a response after processing it; tests cover overlapping uploads, a
   repeated Complete and a CLI publish whose first Complete response is lost.
3. **Addressed.** `src/publish/accounting.ts` is the only counter: counting is
   by digest, Plan-archive files count as uploaded, a digest counts once its
   first PUT attempt starts, and the rich progress total, count and size come
   from the same round accounting. A first publish reports `0 unchanged`, and
   a single-round progress label ends at the summary's count.
4. **Addressed.** Fixture responses are built from bytes and checked against
   their declared status and content type; one shared request assertion
   covers plan, blob and Complete (including `redirect: "manual"`); `302`
   cases send a same-origin `Location` that is never requested. Mutations
   accepting a missing content type or following redirects now fail tests.
5. **Addressed.** Export adapters declare publication metadata
   (`ExportAdapter.publicationMetadata`); publish declares only
   `mokly-upload.json`, which stays in the marker but no longer changes the
   deployment identity, so republishing unchanged content uploads no blob.
6. **Addressed.** Every in-place TTY frame starts with `\r\x1b[2K`; an
   emulated-terminal test covers a shrinking label and a re-plan reset.
7. **Addressed.** The unreachable 16 s cap is gone; `src/publish/retry.ts`
   exports the attempt count, base delay and `Retry-After` ceiling, and the
   guide test derives "five", 1/2/4/8 s and sixty seconds from them.
8. **Partly addressed.** One count formatter serves publish progress,
   publish summaries and Serve. Cancellation and transport exhaustion keep
   `upload-failed` but carry typed presentations with their own messages,
   headlines and hints, so neither repeats a sentence nor tells a user who
   cancelled to check the connection. Other publish rejections still repeat
   their hint; see [second review](#second-review) finding 3.
9. **Addressed.** Over-limit declared sizes and paths are `413` with a new
   `too-large` fixture class, receivers answer `missing` from blobs stored
   for the same project, a test cross-checks fixture classes against the
   status table, and the upload contract is split into
   [`mokly-upload.md`](../protocol/mokly-upload.md) and
   [`mokly-upload-exchange.md`](../protocol/mokly-upload-exchange.md).
10. **Addressed.** Control characters are Unicode category Cc; the fixture
    adds DEL, U+0085, an accepted U+200D, an exactly-1,024-byte path, a
    multibyte over-limit path and exact and case-folded prefix collisions,
    which both readers reject; version precedence is documented.
11. **Addressed.** The earlier-release message now reads "This folder holds
    an export from an earlier Mokly release. Move any files you added, then
    delete `<output>` and export again."
12. **Addressed.** One helper accepts only absolute `http:`/`https:` plan
    URLs whose scheme, hostname and port equal the endpoint's; `blob:` cases
    were added to the plan fixture and the independent reader.
13. **Addressed.** Watch caches parsed markers in a bounded LRU keyed by
    device, inode, size and times, holds owned paths and directory prefixes,
    and reads markers up to 64 MiB; a parse-count test uses an injected
    reader.
14. **Addressed.** `src/publish/run.ts` is split into orchestration, snapshot,
    exchange and accounting modules; response helpers live in `http.ts` and
    every error factory in `src/publish/errors.ts`.
15. **Addressed.** The plan records the squash-merge title and footer, and
    `.github/workflows/pull-request-title.yml` runs a tested validator for
    Conventional Commits titles of at most 50 characters. Making it a
    required check is a post-merge follow-up.

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

## Second Review

Reviewed on 2026-09-27 with
[the implementation review prompt](../implementation-review-prompt.md), after
fix commit `b012d69` was pushed. Three independent read-only reviewers again
covered export, the publish exchange and CLI, and tests, fixtures, packaging
and documentation, using the complete diff against `origin/main` (`3699c56`).
They confirmed findings 1–7 and 9–15 above are fixed; finding 8 is partly
fixed. Eleven new findings follow: two Medium and nine Low. None was changed
during the review. The user then approved option B for finding 1 and option A
for finding 2, which are fixed (see **Second Review Follow-up**); findings
3–11 stay open for the user's decision.

1. **P2 / Medium — After Ctrl+C, publish hides where the previous site was
   left.** [`src/cli/publish.ts`](../../src/cli/publish.ts) (lines 85–86)
   turns any error into "Publication was cancelled." once the abort signal has
   fired. `mokly publish` runs the same transactional export as
   `mokly export`, and if cancellation lands while the export swaps folders
   and the restore or cleanup then fails, the export's error names the backup
   and reservation paths the
   [recovery contract](../protocol/mokly-export-recovery.md) requires the user
   to see. A reviewer's fault-injection run showed `mokly export` printing
   "Export rollback failed; recover the previous site from …/backup…" while
   `mokly publish` printed only the cancellation line, with `site/` gone; the
   suggested retry then failed on the retained reservation. **Impact of no
   change:** rare, but the previous site sits in a hidden backup with no
   pointer to it. **Options:** **A)** rethrow export errors that carry a
   recovery path; **B)** mark cancellation with a type where it originates
   (the export's cancellation check, Git readers, baseline interruption,
   publish) so `runPublish` maps only those to the cancellation copy, with a
   publish subprocess test reusing `tests/helpers/export_failure_preload.ts`
   and the precedence stated in the contracts; **C)** document it.
   **Recommended: B;** inferring cancellation from the signal is the cause.

2. **P2 / Medium — A unit test depends on the live history of
   `origin/main`.** [`tests/verification_pull_request_title.test.ts`](../../tests/verification_pull_request_title.test.ts)
   (lines 48–66) runs `git log origin/main` and fails when any subject on
   `main` uses a type the validator does not list. It fails in a
   single-branch clone, and one commit such as `deps: bump tar` landing on
   `main` would fail `cargo xtask check`, CI and release verification on every
   branch, forcing the validator to follow history. **Impact of no change:**
   an unrelated merge can break every build. **Options:** **A)** drop the
   history scan and keep the fixed type list and the `AGENTS.md` example
   check; **B)** move the history audit into a report-only script; **C)** skip
   when the ref is missing. **Recommended: A,** plus a small static test that
   unit tests never read the real repository's remote-tracking refs.

3. **P3 / Low — Rich errors still repeat their hint.** The 400, 401, 403 and
   422 messages and the default `uploadFailed()` message in
   [`src/publish/errors.ts`](../../src/publish/errors.ts) end with exactly the
   rich hint for their category, so a bad token prints "The service denied
   the upload. Check the token and repository access." and then "Check the
   token and repository access." The
   [terminal contract](../protocol/mokly-terminal-output.md) says a detail
   and hint must never repeat, and local packaging failures get the network
   hint. **Options:** **A)** reword the five messages; **B)** drop detail
   sentences equal to the hint in `cliErrorPresentation` for every category;
   **C)** add a table test rendering every publish error and rejection status
   through the rich reporter. **Recommended: B plus C,** one rule at the
   presentation boundary with a test over every factory.

4. **P3 / Low — Documented progress and summary examples cannot occur.**
   `mokly-upload.json` is always both a marker entry and a Plan-archive file,
   so a shown label starts at 1 or more of 2 or more files and a summary
   uploads at least one file. The exchange and terminal contracts, both
   guides and the plan still show "Uploading 0 of 1 file" as an exact form
   and "0 files uploaded", `guides_*` tests pin that text, and
   `mokly-terminal-output.md` line 219 says "the first three lines" show the
   plural rule when they are Serve and build strings. **Options:** **A)** use
   reachable examples such as "Uploading 1 of 2 files" and state both counts
   are at least one; **B)** do A and derive the documented example in a test
   from a real accounting round. **Recommended: B.**

5. **P3 / Low — Some mockups file names still get unhelpful errors.** Public
   files are found in `src/export/public_files.ts` and copied to `static/…`
   before the portability check runs. Names that are not valid UTF-8 (common
   after unzipping Windows archives) are decoded with `�`, so they fail with
   "is not a regular file" or a raw `ENOENT` instead; other export errors
   print control characters raw (a FIFO named with `ESC[2K` erases the
   line); and the refused path names `static/…` without the reason.
   **Options:** **A)** check names where they are found, reading directory
   entries as bytes, and name the source path and reason; **B)** pass every
   path in an export error through the one escaping helper, enforced by a
   test or lint; **C)** document the `static/` mapping. **Recommended: A
   plus B.**

6. **P3 / Low — "Earlier Mokly release" is shown for every unsupported
   version.** [`src/export/ownership.ts`](../../src/export/ownership.ts)
   (lines 241–244) uses that copy for schema 3, `"2"` and `null` too, so a
   folder written by a newer Mokly is described as older and the user is told
   to delete it. **Options:** **A)** keep the copy for schema 1, use neutral
   copy ("a different Mokly version") for other numbers and treat non-numbers
   as invalid, with tests for 1, 3 and `"2"`; **B)** make the message
   version-neutral; **C)** leave it. **Recommended: A.**

7. **P3 / Low — Watch caches a one-off marker read failure.** The finding 13
   cache in [`src/export/ignored.ts`](../../src/export/ignored.ts) (lines
   105–113) also stores "not an export" when reading throws (for example
   `EMFILE`), so the folder is treated as ordinary files until the marker
   changes; stale versions of one marker also occupy up to 64 entries
   (about 122 MB measured for 20,000-file exports). **Options:** **A)** cache
   only results derived from file content; **B)** do A and keep one entry per
   marker path, replaced when its stats change; **C)** leave it.
   **Recommended: B,** with a reader that fails once then succeeds.

8. **P3 / Low — The packed-consumer smoke receiver still has the old
   Complete behaviour.** [`scripts/package/publish.mjs`](../../scripts/package/publish.mjs)
   decides "already published" at Plan time, returns 409 before 200 and
   overwrites the stored publication on each 201. It is latent because the
   smoke never republishes, but it is the only receiver exercising the
   installed package. **Options:** **A)** delete the unused branch; **B)**
   align it with the contract and add a same-commit republish asserting the
   already-published line; **C)** share the fake receiver's core.
   **Recommended: B.**

9. **P3 / Low — Rejection order is undefined for markers with several bad
   entries.** The ownership and exchange contracts order checks within one
   entry only. All three readers classify the first bad entry in array order
   and check collisions last, but a receiver applying the documented order to
   the whole document passes all 55 fixture cases and still returns 413
   where the CLI returns 400 for a marker with one bad digest and one
   over-limit size. **Options:** **A)** specify array-order, first-failure
   classification with collisions last and add multi-entry fixture cases;
   **B)** specify whole-document phases and change all three readers.
   **Recommended: A,** which matches the code.

10. **P3 / Low — Three shipped statements are stale.**
    [`ci-verification.md`](../protocol/ci-verification.md) says the title
    check is not enforced yet; it and [`npm-release.md`](../protocol/npm-release.md)
    give `chore(main): release 0.13.0` as the release-please title, while
    every release pull request is titled `chore: release main`; and
    [`the-upload.md`](../guides/ci/the-upload.md) points to "the catalogue
    upload document" for rules now in the exchange document. **Options:**
    **A)** fix the three sentences; **B)** also add prose tests.
    **Recommended: A.**

11. **P3 / Low — Byte sizes show "1024.0 KiB" below a unit boundary.**
    `formatBytes` in [`src/cli/reporter/terminal.ts`](../../src/cli/reporter/terminal.ts)
    picks the unit before rounding, so 1,048,575 bytes prints "1024.0 KiB".
    **Options:** **A)** move to the next unit when the rounded value reaches
    1024, with boundary tests; **B)** leave it. **Recommended: A.**

Second-review verification: `cargo xtask check` passed on the fix commit with
Node 24.21.0 (unit 2,498/2,498 across 464 files, browser 781/781 across 122
files, packed-consumer smoke and every static check). Reviewers' focused
reruns passed 52, 73 and 50 tests, mutation checks for finding 4 failed as
intended, and a link check found no new broken links. Residual test risk:
cancellation during export, a public file identical to a Plan-archive file,
IPv6, IDNA or trailing-dot endpoints, an end-to-end terminal-emulated
publish, and the fake receiver's archive rejection order are untested.

### Second Review Follow-up

On 2026-09-27 the user chose option B for finding 1 and option A for finding 2. [Delta Publishing](../../plans/delta-publishing.md) Milestones 14–17
record the decisions and work.

1. **Partly addressed (option B).** `MoklyError` has an explicit
   cancellation mark, and `isCancellation` in `src/errors.ts` accepts only
   that mark or a platform `AbortError`; it never reads causes or messages.
   The export's cancellation check, baseline interruption, publish
   cancellation and the cancellation-only wrappers (a rollback that restored
   the previous export, and the export's wrapper around a non-Mokly abort)
   set the mark; rollback, backup and reservation cleanup failures never do.
   The publish identity readers pass a cancellation through, and
   `src/cli/publish_failure.ts` maps only cancellations to the cancellation
   output. Export recovery errors after Ctrl+C now reach the user with their
   backup or reservation path, and `mokly export` output is unchanged. A
   clean Ctrl+C before installation still often prints a Git, configuration
   or build error instead of the cancellation line; see
   [third review](#third-review) finding 1, since fixed.
2. **Addressed for the title test (option A).** The pull request title test
   no longer reads `origin/main`; it keeps the fixed type list and the
   `AGENTS.md` example check, and passes in a single-branch clone.
   `tests/test_repository_refs.test.ts` uses the TypeScript compiler API to
   fail on direct Git calls in the real checkout that name a remote-tracking
   or upstream reference in the recognised form, and
   `docs/protocol/ci-verification.md` states the rule and its reason. The
   rule is not yet true for the whole suite, and the analyser recognises
   fewer forms than documented; see [third review](#third-review) findings 2
   and 3, since fixed.

Follow-up verification: `cargo xtask check` passed with Node 24.21.0 (unit
2,519/2,519 across 468 files, browser 781/781 across 122 files, packed-consumer
smoke and every static check).

## Third Review

Reviewed on 2026-09-27 with
[the implementation review prompt](../implementation-review-prompt.md), after
fix commit `bf63380` was pushed, against `origin/main` (`3699c56`). Two
independent read-only reviewers covered typed cancellation and the
deterministic-test rule, and rechecked the plan, this document and every
changed link. Three new findings follow: two Medium and one Low. None was
changed during the review. The user then asked to fix all three with their
recommended options, which are fixed (see **Third Review Follow-up**). Second-review findings 3–11 are
still accurate against the current tree; the fix for finding 10 must also
update the title test, which pins `chore(main): release 0.13.0`.

1. **P2 / Medium — Ctrl+C before installation often shows a Git,
   configuration or build error instead of "Publication was cancelled."**
   Since `bf63380`, publish shows the cancellation line only for errors with
   the cancellation mark or named `AbortError`. Two paths break this. First,
   Git reader wrappers turn the Git runner's `AbortError` into plain
   `git-failed` or `review-invalid` errors without the mark
   ([`src/review/git_commands.ts`](../../src/review/git_commands.ts),
   `src/review/git_batch.ts`, `src/review/assets.ts`), and the export passes
   typed errors through unchanged. Second, a terminal sends SIGINT to the
   whole foreground process group, which stops esbuild's service process, so
   the next compile or config load fails as `build-invalid` or
   `config-invalid`. A reviewer saw, for example,
   `[mokly/git-failed] find merge base of origin/main and HEAD: The operation was aborted`
   and `[mokly/config-invalid] could not load …/mokly.config.ts: The service is no longer running`.
   This is a regression from `b012d69`, which mapped any failure after the
   abort to cancellation, and it contradicts the export recovery contract
   and the publish guide. The tests missed it because every spawned
   cancellation test uses `--no-changes` and signals only the Node process.
   **Impact of no change:** users who press Ctrl+C during most of the export
   phase are told Git, the configuration or the build is broken; CI records
   cancellations as failures. No data is lost and the exit status stays 1.
   **Options:** **A)** carry the mark through each wrapper that can wrap an
   abort, keeping codes and messages; this fixes the Git path only;
   **B)** decide at the export boundary: before installation, when a step
   fails after the export's own signal fired, rethrow the error marked as a
   cancellation with its code and message kept. No backup or reservation
   exists yet, so no recovery path can be hidden; installation, rollback and
   cleanup keep today's rules, and the recovery contract owns this
   pre-installation exception to "never infer from the signal"; **C)**
   document that Ctrl+C during export may show the interrupted step's error;
   **D)** with A or B, add spawned publish tests without `--no-changes` for
   committed and derived catalogues that send SIGINT to the whole process
   group at comparison preparation, compile and the input recheck, plus a
   unit matrix of Git readers against an aborted runner.
   **Recommended: B + D.** One boundary rule covers present and future
   wrappers and helper processes; D adds the terminal's real signal delivery
   to the suite.

2. **P2 / Medium — The new "tests never read `origin/main`" rule is already
   broken, and the static test cannot see it.** The example config sets no
   comparison base, so it defaults to `origin/main`
   ([`src/config/validate.ts`](../../src/config/validate.ts)).
   [`tests/preview.test.ts`](../../tests/preview.test.ts) builds the real
   example with `--include-changes`, and the browser suite's server
   ([`playwright.config.ts`](../../playwright.config.ts)) serves it, so both
   read the real checkout's `origin/main` through product code, not a Git
   call in a test. In a single-branch clone `tests/preview.test.ts` fails
   with `baseline-history-unavailable`, and
   [`ci-verification.md`](../protocol/ci-verification.md) still says CI jobs
   that resolve `origin/main` get full history. **Impact of no change:** the
   contract promises tree-only results that release evidence reuse relies
   on, but the suite does not meet it, and the unit suite still fails in
   single-branch clones. **Options:** **A)** correct the contract: limit the
   rule to direct Git calls and name the example preview test and browser
   server as deliberate `origin/main` users; **B)** make both tree-only (build
   the preview test from `tests/helpers/example_baseline.ts` or a local base,
   serve the browser suite with `--base HEAD` or a fixture-owned reference)
   and prove it by running the unit and browser suites in a checkout without
   remote-tracking references; **C)** put a `git` shim on `PATH` in the
   verification runners that fails remote reads in the real checkout.
   **Recommended: B,** using A's wording for anything kept deliberately:
   only a run without those references proves a runtime promise.

3. **P3 / Low — The static test misses common remote reads, and the
   documents overstate it.** In its recognised call shape it misses
   `HEAD..origin/main`, `^origin/main`, `remotes/origin/main`,
   `--remotes=origin`, `-r`, `--all`, `fetch origin main`, `ls-remote origin`
   and `@{U}`/`@{UPSTREAM}`; it also misses Git calls without `cwd` (the
   unit runner's working directory is the repository root), aliases of
   `repositoryRoot`, references held in variables, shell strings and
   `scripts/` modules the tests run, and it flags `repositoryRoot` anywhere in
   a call, even in `env`. Only 1 of the 34 direct Git calls in the scanned
   files uses the recognised shape. **Impact of no change:** a plausible
   regression such as `git branch -r` passes while the documents say it
   cannot. **Options:** **A)** widen the matcher (calls without `cwd`,
   `-r`, `--all`, `refs/remotes`, case-insensitive upstream spellings,
   aliases; take the target only from `cwd` or `-C`); **B)** keep it as a
   best-effort lint behind finding 2's runtime check; **C)** document
   exactly what it recognises. **Recommended: B + C,** plus A's cheap cases.

Third-review verification: the reviewers' focused reruns passed 34, 16, 28,
25, 4 and 11 tests; every relative link and anchor in the 31 changed
Markdown files resolves. Residual test risk: Ctrl+C on Windows (Git is not
in its own process group there), a Ctrl+C while reading the Complete body
after the receiver published, and no run of the suites in a checkout
without remote-tracking references.

### Third Review Follow-up

On 2026-09-27 the user asked to fix all three findings with their recommended
options. [Delta Publishing](../../plans/delta-publishing.md) Milestones 18–22
record the decisions and work. The fixes also complete second-review
follow-ups 1 and 2 above.

1. **Addressed (options B and D).** The
   [export recovery contract](../protocol/mokly-export-recovery.md#pre-installation-window)
   defines a pre-installation window: publish configuration loading,
   repository identity, comparison preparation and the base-manifest read,
   compile, public-file capture, assembly, the adapter transform, staging
   with its capture, and the input recheck. Opening the export transaction
   and writing the generated build output are excluded because their
   failures carry recovery guidance. A failure in the window after the
   command's signal fired becomes a cancellation that keeps its code and
   message (`withPreInstallationCancellation` in `src/export/error.ts`), so
   `mokly export` output is unchanged and `mokly publish` prints the
   cancellation line; installation, rollback and cleanup keep the explicit
   marks. Spawned publish tests without `--no-changes`, for committed and
   derived catalogues, send SIGINT to the whole process group during
   comparison preparation, staging, the input recheck and configuration
   loading, and a unit matrix covers each Git reader. A timing race with
   esbuild remained; see [fourth review](#fourth-review) finding 1, since
   fixed.
2. **Addressed (option B).** `tests/preview.test.ts` builds an isolated copy
   of the example with a fixture-owned baseline and one deterministic edit,
   and the browser suite's server compares with `--base HEAD`. CI no longer
   reads `origin/main` for the baseline lockfile and deletes every
   remote-tracking reference and `FETCH_HEAD` before the unit and browser
   suites, and [`ci-verification.md`](../protocol/ci-verification.md) states
   the rule; the fourth review found the removal step fragile, the preview
   edit unasserted and two stale sentences (findings 2–4, since fixed).
   Before delivery, the full unit suite (2,532/2,532) and browser suite
   (781/781) passed in a clone with no remote-tracking references.
3. **Addressed (options B and C, with A's cheap cases).** The static test is
   documented as a best-effort lint behind the remote-free runs. It takes the
   target only from `cwd` or `-C` (a call with neither targets the real
   checkout), and recognises `origin/` and `remotes/` anywhere in an
   argument, `refs/remotes`, `-r`, `--all`, `--remotes`, `FETCH_HEAD`,
   upstream spellings in any letter case and the `fetch` and `ls-remote`
   subcommands; `ci-verification.md` describes what it recognises and cannot
   see, though not exactly (see [fourth review](#fourth-review) finding 5,
   since fixed).

Follow-up verification: `cargo xtask check` passed with Node 24.21.0 (unit
2,532/2,532 across 470 files, browser 781/781 across 122 files, packed-consumer
smoke and every static check), and the remote-free unit and browser runs above
passed.

## Fourth Review

Reviewed on 2026-09-27 with
[the implementation review prompt](../implementation-review-prompt.md), after
fix commit `78f259d` was pushed, against `origin/main` (`3699c56`). Two
independent read-only reviewers covered the pre-installation window and the
tree-only tests, CI step and lint, and rechecked the plan, this document and
every changed link. They confirmed the third-review fixes work in the common
case. Seven new findings follow: one Medium and six Low. None was changed
during the review. The user then asked to fix all seven with their
recommended options, which are fixed (see **Fourth Review Follow-up**).
Second-review findings 3–11 stay open.

1. **P2 / Medium — Ctrl+C during an esbuild step can still print a build
   error.** `withPreInstallationCancellation` in
   [`src/export/error.ts`](../../src/export/error.ts) decides "was this a
   cancellation?" when a step fails, by reading the command's abort signal.
   A terminal Ctrl+C also kills esbuild, which shares the command's process
   group, and Node may notice esbuild's death before it runs the SIGINT
   listener that sets the signal. The failure then passes through as
   `[mokly/build-invalid] could not bundle consumer modules: The service was stopped: write EPIPE`.
   A reviewer reproduced it in 3–10 of 51 presses during compile, in both
   committed and derived catalogues, and deterministically from an esbuild
   plugin; the new spawned tests miss it because their hooks always let the
   listener run first, and no test covers compile. Git and baseline steps are
   unaffected. **Impact of no change:** some deliberate cancellations are
   still reported as broken builds. **Options:** **A)** when a step fails and
   the signal is not yet set, wait one event-loop turn and check again;
   **B)** tag window failures and decide at the command boundary after
   cleanup (still needs A for configuration loading and identity); **C)**
   keep esbuild out of the process group (esbuild's API does not allow it);
   **D)** add a spawned compile test whose hook waits for esbuild to exit,
   and a unit test where the step fails in the same turn an abort is queued.
   **Recommended: A + D,** and define "after the signal fired" in the
   recovery contract.

2. **P3 / Low — The CI step that removes remote-tracking references crashes
   on a symbolic `origin/HEAD` and leaves `origin` fetchable.** In
   [`ci.yml`](../../.github/workflows/ci.yml), `git for-each-ref … | git update-ref --stdin`
   has no `--no-deref`, so Git follows `refs/remotes/origin/HEAD` and rejects
   the batch; the lead reproduced
   `fatal: multiple updates for 'refs/remotes/origin/master' (including one via symref 'refs/remotes/origin/HEAD') are not allowed`
   in an ordinary clone. CI passes today only because its checkout writes no
   `origin/HEAD`, and a plain `git fetch origin` recreates every reference
   afterwards. `tests/ci_workflow.test.ts` only checks substrings.
   **Impact of no change:** if a checkout ever writes `origin/HEAD`, every
   unit and browser job fails, and the documented local remote-free run has
   no working tooling. **Options:** **A)** add `--no-deref`; **B)** move the
   step into one repository script shared by CI and the local run (remove
   each remote, delete leftover references with `--no-deref`, delete
   `FETCH_HEAD`, verify) and test it in a fixture clone with `origin/HEAD`, a
   packed reference, a pull reference and `FETCH_HEAD`, asserting
   `git fetch origin` then fails; **C)** document that checkouts must have no
   symbolic remote references. **Recommended: B.**

3. **P3 / Low — The preview test's deterministic edit is never asserted.**
   [`tests/preview.test.ts`](../../tests/preview.test.ts) edits the Welcome
   badge, but its count check accepts 0 and its diff attributes render for
   every screen whenever comparisons are on; a reviewer built the fixture
   with and without the edit and every assertion passed both ways. The CI
   contract says the edit keeps the comparison assertions meaningful.
   **Impact of no change:** a preview that detects or publishes no change
   would still pass. **Options:** **A)** assert the changed count, that
   Welcome is marked Changed and that an unedited screen stays Unmodified;
   **B)** A plus a before-and-after build in one fixture; **C)** drop the
   claim. **Recommended: A.**

4. **P3 / Low — Two protocol documents still describe the removed
   merge-base lockfile.** [`ci-verification.md`](../protocol/ci-verification.md)
   says jobs that run historical installs add a lockfile read from the
   merge-base commit, and [`npm-release.md`](../protocol/npm-release.md) says
   CI includes the merge-base lockfile in cache keys and ties full history to
   resolving `origin/main`; only the Preview workflow still does this.
   **Impact of no change:** the documents contradict each other, and restoring
   CI to match them would bring back the `origin/main` read. **Options:**
   **A)** correct the three sentences; **B)** A and link `npm-release.md` to
   `ci-verification.md` for caching and history instead of repeating it;
   **C)** A plus a prose test. **Recommended: B.**

5. **P3 / Low — The lint's new default flags legitimate code, and its
   documented lists are not exact.** `tests/helpers/test_repository_refs.ts` (since removed)
   treats shorthand `{ cwd }`, an options variable or a spread as "no
   `cwd`", which means the real checkout, and matches `-r` for every
   subcommand, so `git ls-tree -r HEAD` in the real checkout is flagged. It
   also misreads `-C` after the subcommand, and `-c name=value` or
   `--git-dir` hide the subcommand. The CI contract omits several blind spots
   (`branch -a`, `HEAD..FETCH_HEAD`, `git remote`, `scripts/` modules).
   **Impact of no change:** idiomatic fixture code fails the unit suite, which
   pushes authors to hide arguments in variables. **Options:** **A)** fix the
   false positives (accept shorthand `cwd`, treat non-inline options as
   unknown, limit `-r`/`-a`/`--all`/`--remotes` to reference-listing
   subcommands, skip option values when finding the subcommand, read `-C`
   only before it) with synthetic cases; **B)** keep the code, document the
   behaviour and blind spots and drop "exactly"; **C)** retire the lint.
   **Recommended: A for the false positives plus B for the rest,** and invest
   in finding 2's runtime guard rather than a fuller parser.

6. **P3 / Low — Ctrl+C just after esbuild starts can exit with code 13.**
   esbuild unreferences its pipes, so if Ctrl+C kills it during startup
   (configuration loading), Node sees nothing left to wait for and exits with
   only `Warning: Detected unsettled top-level await` and status 13, no Mokly
   message. A reviewer captured it 2 times in about 1,000 presses; it
   predates `78f259d`. **Impact of no change:** rare confusing output and a
   wrong exit status. **Options:** **A)** keep a referenced handle alive for
   the whole of `runPublish` and `runExport`; **B)** make esbuild calls reject
   when the command signal aborts; **C)** document it. **Recommended: A.**

7. **P3 / Low — After a classified Ctrl+C, diagnostic mode shows the wrong
   stack.** The window helper throws a new copy of the error, so
   `MOKLY_DIAGNOSTIC=1` prints a stack pointing at the helper, and baseline
   error subclasses lose their extra fields (`argv`, `exitCode`,
   `outputLines`); the original survives only as an unprinted `cause`.
   Normal output is unchanged. **Options:** **A)** mark the original error as
   cancelled in place (a private set that `isCancellation` checks); **B)**
   copy `stack` and `name` onto the copy; **C)** print the cause chain in
   diagnostic mode. **Recommended: A.**

Fourth-review verification: the reviewers' focused reruns passed 12, 19, 2,
31 and 16 tests; about 1,000 timed process-group presses exercised the
window; every relative link and anchor in the 31 changed Markdown files
resolves. Residual test risk: Windows (the process-group tests are skipped),
the release workflow's complete-verification fallback still runs with remote
references present, an unused `includeChanges` path in
`tests/browser/preview_fixture.ts` would read `origin/main`, and the preview
test now rebuilds a baseline on every run (about 6.6 minutes).

### Fourth Review Follow-up

On 2026-09-27 the user asked to fix all seven findings with their recommended
options. [Delta Publishing](../../plans/delta-publishing.md) Milestones 23–27
record the decisions and work.

1. **Addressed (options A and D).** When a window step fails while the
   command's signal is not yet set, `withPreInstallationCancellation` lets the
   event loop complete one full turn with an I/O poll (two `setImmediate`
   hops, no wall-clock delay) and checks again, so a terminal Ctrl+C that
   stops esbuild is classified correctly. The
   [recovery contract](../protocol/mokly-export-recovery.md#pre-installation-window)
   defines this and lists every covered step. A spawned compile test for
   committed and derived catalogues signals the process group from inside
   esbuild work and waits for esbuild to exit; it fails 3 of 3 without the
   fix and is the real guard, because a sweep on an idle machine cannot tell
   fixed from broken code. A 280-press sweep on a loaded machine printed the
   cancellation line every time.
2. **Addressed (option B).** `scripts/verification/remove-remote-state.mjs`
   removes every configured remote with its references and upstream
   settings, deletes leftover `refs/remotes/*` without following symbolic
   references, deletes `FETCH_HEAD` and verifies nothing remains. CI's unit
   and browser jobs and the documented local procedure use it; a fixture
   clone with a symbolic `origin/HEAD`, packed references, a pull reference,
   an upstream setting and `FETCH_HEAD` exercises it, and `git fetch origin`
   then fails. Its safety and failure checks need more work; see
   [fifth review](#fifth-review) findings 1 and 2.
3. **Addressed (option A).** The preview test asserts that its edit changes
   exactly the Welcome and tour destinations, that the navigation count is 2,
   that Welcome is marked changed and that Details is unmodified; the test
   fails without the edit.
4. **Addressed (option B).** The stale merge-base lockfile sentences are gone,
   and [`npm-release.md`](../protocol/npm-release.md) links to
   [`ci-verification.md`](../protocol/ci-verification.md) for CI caching and
   Git history instead of repeating them.
5. **Addressed (options A and B).** The lint accepts shorthand `{ cwd }`,
   treats non-inline options as an unknown target, finds the subcommand after
   skipping global option values, reads `-C` and `--git-dir` only before it,
   and counts `-r`, `-a`, `--all` and `--remotes` only for reference-listing
   subcommands; `ci-verification.md` documents its behaviour and blind spots
   without claiming completeness.
6. **Addressed (option A).** `mokly export` and `mokly publish` hold a
   referenced handle (`src/cli/keep_alive.ts`) from installing their signal
   listeners until they finish, so a Ctrl+C during esbuild startup settles
   through Mokly's output with status 1; a spawned test shows the same work
   exits with status 13 without the handle.
7. **Addressed (option A).** Cancellation marks live in a private registry
   in `src/errors.ts` that `isCancellation` and `MoklyError.cancelled` read;
   the window marks the original error in place, so its class, fields and
   stack survive, and publish substitutes its fixed cancellation copy only
   when rendering. `MOKLY_DIAGNOSTIC=1` now shows the failing operation's
   stack for Mokly errors; a Git abort during repository identity still shows
   the publish boundary (see [fifth review](#fifth-review) finding 4).

Follow-up verification: `cargo xtask check` passed with Node 24.21.0 (unit
2,546/2,546 across 473 files, browser 781/781 across 122 files,
packed-consumer smoke and every static check), and the unit and browser suites
passed again in a copy prepared with the shared remote-free script.

## Fifth Review

Reviewed on 2026-09-28 with
[the implementation review prompt](../implementation-review-prompt.md), after
fix commit `4f230ad` was pushed, against `origin/main` (`3699c56`). Two
independent read-only reviewers covered cancellation timing, keep-alive and
in-place marks, and the remote-free script, CI, preview assertions and lint,
and rechecked the plan, this document and every changed link. They confirmed
the seven fourth-review fixes work: 280 timed process-group presses during
compile and 140 during configuration loading all printed the cancellation line
with status 1. Five new findings follow: one Medium and four Low. None was
changed during the review. The user then chose to remove the cleanup script,
which resolves finding 1 and part of finding 2 (see **Fifth Review
Follow-up**), and later removed the lint, which resolves finding 3 (see
**Sixth Review Follow-up**); the rest await the user's decision. A stale title-check sentence in
`ci-verification.md` that a reviewer also reported is already open as
second-review finding 10, and the missing "completed" marker on Milestone 24
was corrected in the plan while recording this review. Second-review findings
3–11 stay open.

1. **P2 / Medium — The documented local run can delete the real repository's
   remotes.** `scripts/verification/remove-remote-state.mjs` (since removed)
   changes whichever Git store the current folder uses. Conductor workspaces
   are Git worktrees that share one store, so running it in a linked worktree,
   or in a `cp -a` copy of one (its `.git` file still points at the shared
   store), deletes `origin`, every remote-tracking reference and every
   upstream setting of the main checkout too; the lead reproduced this. In a
   partial clone (this workspace is one), removing the promisor remote also
   makes history that was never downloaded unreadable. The
   [CI contract](../protocol/ci-verification.md) and Milestone 27 tell
   developers to run it in "a separate copy". **Impact of no change:** a
   routine delivery step can silently break fetch, push, upstream tracking
   and history reads in the real repository and all its workspaces.
   **Options:** **A)** refuse before changing anything unless the Git
   directory is the common directory, there is one worktree and no promisor
   remote; **B)** provide a script that creates the disposable copy with its
   own `.git` and cleans only that copy; **C)** only document the hazard.
   **Recommended: A + B,** with fixtures for a linked worktree, a copied
   worktree and a partial clone.

2. **P3 / Low — The script's fail-closed checks are weaker than documented
   and untested.** Its final check fails on any branch upstream, including a
   branch that tracks a local branch (`branch.<name>.remote = .`), which is
   not remote state and which the contract does not mention; the script then
   exits 1 after removing every remote. Mutation runs showed that removing
   the final check, or dropping `--no-deref`, still passes
   `tests/verification_remote_state.test.ts`, whose only failure case runs
   outside a repository. Its entry guard compares `import.meta.url` with the
   unresolved script path, so run through a symlinked path (for example
   macOS `/tmp`) it exits 0 having done nothing; `pull-request-title.mjs`
   uses the same guard. **Impact of no change:** wrong failures for stacked
   branches, and a regression in either protection or a symlinked run would
   let the suites run with remote state unnoticed. **Options:** **A)** ignore
   local upstreams and document the upstream check; **B)** add failure
   fixtures, including a leftover symbolic reference that must keep its
   target; **C)** one shared, real-path entry helper for all scripts, tested
   through a symlink. **Recommended: A + B + C;** C stops the fail-open
   pattern recurring.

3. **P3 / Low — The lint still contradicts its documentation and flags
   fixture code.** `tests/helpers/test_repository_refs.ts` (since removed)
   treats a callback argument (`execFile("git", [...], callback)`) and inline
   options written with `as`, `satisfies` or parentheses as unknown options,
   although the contract says a call with no options targets the real
   checkout. It counts a target as the real checkout whenever its expression
   mentions `repositoryRoot`, so `cwd: path.join(repositoryRoot, ".context", "fixture")`
   — where this repository keeps fixtures — is flagged when a fixture reads
   its own `origin/main`, while `process.cwd()`, `"."` and a relative `-C` are
   never reported and are not listed blind spots. For `log`, `-r` and `-a`
   are diff options, so `git log -r --name-status HEAD` is still flagged.
   **Impact of no change:** legitimate fixture code can fail the unit suite,
   and the contract misleads authors. **Options:** **A)** unwrap
   `as`/`satisfies`/parentheses, treat a function argument as no options,
   keep `-r`/`-a` only for `branch` and `show-branch`, and treat `.context`
   paths as fixtures, each with synthetic cases; **B)** document the target
   rule and remaining blind spots; **C)** retire the lint.
   **Recommended: A for the false positives and contradictions, B for the
   rest,** without growing a fuller parser.

4. **P3 / Low — Some publish cancellations still replace the original
   error.** When a Git command is stopped by Ctrl+C, Node produces a platform
   `AbortError`, and [`publish_failure.ts`](../../src/cli/publish_failure.ts)
   swaps it for a fresh `PublishCancelledError` with no cause (the test
   requires this). Now that `main.ts` substitutes the cancellation copy when
   rendering, the swap is redundant, and with `MOKLY_DIAGNOSTIC=1` a Ctrl+C
   during repository identity or the final HEAD check prints the publish
   boundary's stack instead of the Git abort. **Impact of no change:**
   misleading diagnostics, and the READMEs overstate the fix. **Options:**
   **A)** return every cancellation unchanged from `publishFailure`; **B)**
   keep the swap, set `cause` and print the cause chain in diagnostic mode;
   **C)** document it. **Recommended: A,** with an identity assertion, a
   spawned diagnostic test for Ctrl+C during repository identity, and one
   table test pushing every cancellation source through `runPublish`.

5. **P3 / Low — Files have grown past the size rules.** `AGENTS.md` asks for
   files under about 300 lines and protocol documents near 250. This branch
   grew `tests/guides_ci.test.ts` to 532 lines, `tests/publish_run.test.ts`
   to 386, `tests/ci_workflow.test.ts` to 356, `scripts/package/publish.mjs`
   to 307, `ci-verification.md` to 448, `mokly-terminal-output.md` to 311 and
   the new `mokly-upload-exchange.md` to 318. **Impact of no change:** harder
   reviews, and each round adds more. **Options:** **A)** split them by
   contract (the guides test per document, the workflow test per job, the
   lint and title contracts into their own protocol documents); **B)** A plus
   a size audit for non-Rust files in `cargo xtask check`, with an allowlist
   for plans, reviews and fixtures; **C)** leave it. **Recommended: B.**

Fifth-review verification: the reviewers' focused reruns passed 16, 3, 14 and
32 tests; every relative link and anchor in the 31 changed Markdown files
resolves. Residual test risk: Windows (Ctrl+C arrives on a console-handler
thread and the process-group tests are skipped), the exit-13 race is only
reproducible statistically, the release workflow's complete-verification
fallback still runs with `origin` present, the script is untested on macOS
and Windows, and a pre-existing `npm-release.md` sentence names a
GitHub-hosted release runner while `release.yml` uses Blacksmith.

### Fifth Review Follow-up

On 2026-09-28 the user judged the cleanup script too dangerous and asked to
remove it instead of guarding it. [Delta Publishing](../../plans/delta-publishing.md)
Milestones 28–29 record the decision and work.

1. **Resolved by removal.** `scripts/verification/remove-remote-state.mjs`, its
   declaration file and `tests/verification_remote_state.test.ts` are deleted,
   and CI's unit and browser jobs no longer run a cleanup step, so no command
   in the repository removes remotes. The
   [CI contract](../protocol/ci-verification.md#deterministic-test-repository-inputs)
   keeps the rule that tests depend only on the tree under test and its two
   fixes (the preview test's fixture-owned baseline and the browser server's
   `--base HEAD`); it no longer promises a runtime proof, and the best-effort
   lint is now the only automated check. Nothing automatically proves that no
   test reads remote-tracking references.
2. **Partly resolved by removal.** The script-specific parts (the local-upstream
   check and the untested protections) went with the script. The symlinked-path
   entry guard still applies to `scripts/verification/pull-request-title.mjs`,
   which CI runs by relative path, and stays open.

Findings 3–5 stay open; finding 3 was later resolved by removing the lint
(see **Sixth Review Follow-up**).

Follow-up verification: `cargo xtask check` passed with Node 24.21.0 (unit
2,544/2,544 across 472 files, browser 781/781 across 122 files,
packed-consumer smoke and every static check).

## Sixth Review

Reviewed on 2026-09-28 with
[the implementation review prompt](../implementation-review-prompt.md), after
commit `820849d` (`ci: remove the remote-state cleanup script`) was pushed,
against `origin/main`. One independent read-only reviewer confirmed the
removal is complete: no command in the repository removes remotes, nothing
references the deleted files, both CI steps are gone, the unit and browser
jobs never read `origin/main`, and every link resolves. Three findings follow,
all Low. None was changed during the review. The user then chose to remove the
lint and restore a workflow check for finding 1 (see **Sixth Review
Follow-up**); the rest of findings 2 and 3 await the user's decision.

1. **P3 / Low — Nothing stops a remote-cleanup step from coming back.** The
   commit deleted the workflow test's check that the unit and browser jobs
   contain no inline `for-each-ref`/`update-ref` cleanup, and the lint scans
   only `tests/` and does not flag `git remote remove`. A reviewer re-added
   `git remote remove origin`, and separately the old inline step, to both
   jobs, and every workflow test still passed; this branch added cleanup in two
   review rounds in a row. **Impact of no change:** a later fix could bring
   back the command that deletes the remotes Conductor worktrees share, with
   every test green. **Options:** **A)** restore the negative check and widen
   it to every job in every workflow (no `git remote remove`/`rm`,
   reference-deleting `update-ref`, `--unset-upstream` or
   `remove-remote-state`); **B)** A, plus make the lint flag commands that
   change the real checkout's remote state and scan `scripts/` too;
   **C)** rely on the plan's recorded decision. **Recommended: B.**

2. **P3 / Low — A guide test dropped a check instead of updating it.**
   `tests/guides_ci.test.ts` used to require the sentence that identical trees
   must produce identical test results; the commit reworded the sentence and
   deleted the assertion, so no test checks it now. A reviewer replaced the
   sentence with a promise of a remote-free runtime proof and all guide tests
   still passed. **Impact of no change:** the rule, which release evidence
   reuse depends on, and the removal can drift out of the shipped contract
   unnoticed. **Options:** **A)** restore the assertion with the new wording;
   **B)** A, plus assert the contract no longer names the script or promises a
   runtime proof; **C)** leave it. **Recommended: B.**

3. **P3 / Low — Two sentences misstate the remaining checks.**
   [`ci-verification.md`](../protocol/ci-verification.md) calls the lint "the
   only automated check for this rule", but `tests/deployment.test.ts` checks
   the browser server's `--base HEAD` and `tests/ci_workflow.test.ts` checks
   CI's lockfile input and the absence of `origin/main`. The plan's Script
   Removal Decision says CI "keeps reading the baseline lockfile from the
   checked-out tree", but CI reads no baseline lockfile; it keys npm's cache
   from `package-lock.json`. **Impact of no change:** maintainers may miss
   those tests, and the plan wording could lead someone to restore a step the
   tests reject. **Options:** **A)** reword both (the lint is "the only general
   check", naming the two tests; the plan names the npm cache key) and update
   the guide test's pattern; **B)** fix only the plan; **C)** leave both.
   **Recommended: A.**

Sixth-review verification: the reviewer's focused reruns passed 24, 10, 6 and
10 tests, and 245 relative links and anchors resolve. Residual risk: CI's unit
and browser jobs now run with `origin/*` references present, so an accidental
read of the real checkout's `origin/main` would pass silently; one unused
browser helper (`startPreviewFixture(true)` in `tests/browser/preview_fixture.ts`)
would do exactly that if a spec started using it.

### Sixth Review Follow-up

On 2026-09-28 the user chose, for finding 1, to remove the remote-branch lint
and restore a small workflow check instead of widening the lint.
[Delta Publishing](../../plans/delta-publishing.md) Milestones 30–31 record
the decision and work.

1. **Addressed (option A, with the lint removed).**
   `tests/ci_workflow_remote_state.test.ts` reads every `run:` step of every
   workflow and of the composite action and fails if any deletes remote Git
   state: `git remote remove`/`rm`, deleting `git update-ref` forms or one
   naming `refs/remotes`, remote-branch deletion and `--unset-upstream` with
   `git branch`, removing `remote.`/`branch.` configuration, or the old
   script's name. Synthetic cases cover each form, multi-line blocks,
   continuations and chained commands, and the old inline cleanup step is
   flagged. It is a text check and cannot see commands inside scripts a step
   calls. The lint (`tests/test_repository_refs.test.ts` and its helper) is
   deleted, so nothing scans test code for remote-branch reads any more; the
   [CI contract](../protocol/ci-verification.md#deterministic-test-repository-inputs)
   says new tests rely on review for that and names the remaining checks.
2. **Partly addressed.** The rewritten guide test pins the rule and its
   reason again ("Identical trees must produce identical test results"); it
   does not add option B's assertion that the contract no longer names the
   script or a runtime proof.
3. **Partly resolved by removal.** The lint sentence ("the only automated
   check") went with the lint, and the contract now names the remaining
   checks. The plan's Script Removal Decision still says CI "keeps reading
   the baseline lockfile from the checked-out tree"; that sentence stays open.

Fifth-review finding 3 (the lint's false alarms and contradictions) is
resolved by the lint's removal.

Follow-up verification: `cargo xtask check` passed with Node 24.21.0 (unit
2,542/2,542 across 472 files, browser 781/781 across 122 files,
packed-consumer smoke and every static check).

## Seventh Review

Reviewed on 2026-09-28 with
[the implementation review prompt](../implementation-review-prompt.md), after
commits `a7d0a07` (`test: replace the git ref lint with a workflow guard`) and
`58a8c15` were pushed, against `origin/main`. One independent read-only
reviewer confirmed the lint removal is complete, nothing expects the deleted
files, the guard reads all 58 `run:` steps in the four workflows and the
composite action with none flagged, and the contract's named tests check what
it says. Two findings follow, both Low. None was changed; each awaits the
user's decision. A third finding, that this record still called fifth-review
finding 3 open, was corrected while recording this review.

1. **P3 / Low — The workflow guard misses common inline forms, but the
   documents say its only limit is called scripts.**
   `tests/ci_workflow_remote_state.test.ts` only checks commands whose first
   word is `git`, treats the path after a separated `--git-dir` as the
   subcommand, knows only the dashed `git config --unset` spellings and does
   not handle shell comments. In a throwaway clone, each of these deleted
   remote state and none was flagged: `bash -c '…'`/`sh -c '…'`, a
   `for r in $(git remote); do git remote remove "$r"; done` loop, commands
   inside `if … then … fi`, `xargs -n 1 git update-ref -d`, `GIT_DIR=… git …`,
   `git --git-dir "$D" remote remove origin`, the newer `git config unset` and
   `git config remove-section` spellings, `git symbolic-ref --delete
refs/remotes/origin/HEAD`, `git remote set-head origin --delete`,
   `git remote -v remove origin` and `git branch -qdr`; an apostrophe in an
   earlier comment hides every later line of a step. `git push origin --delete`
   also deletes the local remote-tracking branch, and the contract does not say
   whether that is in scope. [`ci-verification.md`](../protocol/ci-verification.md),
   the plan and this record name called scripts as the only limit.
   **Impact of no change:** false assurance; the natural loop or `xargs` form
   of the removed cleanup would pass with every test green. **Options:**
   **A)** extend the tokenizer to cover shell keywords, wrappers, `-c` strings,
   comments, separated options and the new spellings; **B)** replace the
   tokenizer with a case-insensitive pattern scan over each whole step, add the
   probes above as positive cases and reword any prose the patterns catch;
   **C)** only document the real limits. **Recommended: B, plus C** for what a
   text scan still cannot see (dynamic commands, called scripts) and a stated
   decision on `git push --delete`; a reviewer's eight-pattern prototype caught
   all 16 probes and flagged none of the 58 real steps.

2. **P3 / Low — A test file exports a function.** The same file exports
   `remoteStateDeletingCommands`, the only real top-level export in any test
   file; shared test code lives in `tests/helpers/`, and importing a test file
   also runs its tests in the importing file. **Impact of no change:** harmless
   today, but reuse would run these tests twice. **Options:** **A)** drop the
   `export`; **B)** move the scanner into a `tests/helpers/` module, which also
   keeps the test under 300 lines once finding 1 adds cases; **C)** B plus an
   ESLint rule banning exports from test files. **Recommended: B.**

Seventh-review verification: the reviewer's focused runs passed 41 and 2
tests, Prettier and ESLint are clean, and all 170 relative links and anchors in
the changed Markdown files resolve. Residual risk: by the user's decision
nothing scans test code for remote-branch reads, and the guard cannot see
commands in `scripts/`, `xtask` or dynamic commands.

### Seventh Review Follow-up

On 2026-09-28 the user chose option B for finding 2.
[Delta Publishing](../../plans/delta-publishing.md) Milestones 32–33 record
the decision and work.

2. **Addressed (option B).** `remoteStateDeletingCommands` and its private
   shell splitting and tokenizing moved byte-for-byte into
   `tests/helpers/remote_state_commands.ts`.
   `tests/ci_workflow_remote_state.test.ts` imports it, keeps its synthetic
   cases and its workflow reading, and exports nothing. The
   [CI contract](../protocol/ci-verification.md#deterministic-test-repository-inputs)
   names the helper beside the guard, and `tests/guides_ci.test.ts` pins that
   sentence. Parsing all 491 test files with the TypeScript parser finds no
   top-level export and no import of a test file; the other `export` lines a
   text search finds are fixture source inside template strings. No lint rule
   bans exports from test files, because option C was not chosen.

Finding 1 stays open for the user's decision.

Follow-up verification: `cargo xtask check` passed with Node 24.21.0 (unit
2,646/2,646, browser 860/860, packed-consumer smoke and every static check),
and the focused guard, CI workflow and guides tests passed 42/42.

## Eighth Review

Reviewed on 2026-09-28 with
[the implementation review prompt](../implementation-review-prompt.md), after
commits `55503d3` (`chore: merge main into bogota-v7`) and `6e84de7`
(`test: move the remote-state scanner to a helper`) were pushed, against
`origin/main`. One independent read-only reviewer confirmed that the merge
applied every line main's #121 added or removed across its 186 files and kept
every branch change across 170 files, with no other edit beyond the
`plans/README.md` resolution; that main's new comparison specs start their own
fixture repositories with `base: "HEAD"` and do not use the shared example
server; and that the scanner moved byte-for-byte, with no top-level export in
any of the 625 test and spec files and no import of a test file. One finding
follows, Low. It was not changed; it awaits the user's decision.

1. **P3 / Low — The Seventh Review's summary still calls both of its findings
   open.** Its opening paragraph says "Two findings follow, both Low. None was
   changed; each awaits the user's decision", but the Seventh Review Follow-up
   says finding 2 is addressed. Every earlier round's summary was edited to
   point to its follow-up once one was written. This is the second such slip in
   two rounds (the Seventh Review corrected one for fifth-review finding 3),
   because the plan's recording task names only the follow-up.
   **Impact of no change:** a reader of the summary, the part meant to be read
   first, would think the test-export finding still needs a decision and might
   raise it again or redo the work; code is unaffected. **Options:** **A)**
   reword the summary to say the user chose option B for finding 2, which is
   addressed (see the Seventh Review Follow-up), and that finding 1 awaits the
   user's decision; **B)** A, plus have future recording tasks in the plan
   also update that review's summary and any earlier status sentence the
   change affects; **C)** A, plus a test that every review section with a
   follow-up points to it from its summary; **D)** leave it.
   **Recommended: B.** The direct fix is needed either way, and one sentence
   in the recording task addresses the cause at no code cost. A test would
   protect little: no other review record uses this summary-and-follow-up
   layout, and this one stops receiving follow-ups when the pull request
   merges.

Eighth-review verification: 276 relative links and anchors in the changed
Markdown resolve; replaying the new pin against the contract without the
helper sentence fails; the guard, guides and CI workflow tests passed 38/38,
and the related protocol, guide-structure, removed-preview and import-order
tests passed 11/11; Prettier and ESLint are clean. Residual risk: the reviewer
relied on the recorded `cargo xtask check` (unit 2,646/2,646, browser 860/860)
rather than re-running the suites.
