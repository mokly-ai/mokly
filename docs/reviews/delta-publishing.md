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

1. **Addressed (option B).** `MoklyError` has an explicit cancellation mark,
   and `isCancellation` in `src/errors.ts` accepts only that mark or a
   platform `AbortError`; it never reads causes or messages. The export's
   cancellation check, baseline interruption, publish cancellation and the
   cancellation-only wrappers (a rollback that restored the previous export,
   and the export's wrapper around a non-Mokly abort) set the mark; rollback,
   backup and reservation cleanup failures never do. The publish identity
   readers pass a cancellation through instead of reporting a Git failure,
   and `src/cli/publish_failure.ts` maps only cancellations to the
   cancellation output. Spawned publish tests prove a clean rollback prints
   the cancellation line and restores the previous site, while a failed
   restore or reservation cleanup prints the export recovery error with its
   backup or reservation path. `mokly export` output is unchanged, and the
   exchange, terminal and export recovery contracts state the precedence.
2. **Addressed (option A).** The pull request title test no longer reads
   `origin/main`; it keeps the fixed type list and the `AGENTS.md` example
   check, and passes in a single-branch clone. `tests/test_repository_refs.test.ts`
   uses the TypeScript compiler API to fail on any direct Git call in the
   real checkout that names a remote-tracking or upstream reference, with
   synthetic positive and negative cases. `docs/protocol/ci-verification.md`
   states the rule, its reason (release evidence reuse needs identical trees
   to give identical results) and the analyser's limit: Git calls hidden
   behind helper closures still need review.

Follow-up verification: `cargo xtask check` passed with Node 24.21.0 (unit
2,519/2,519 across 468 files, browser 781/781 across 122 files, packed-consumer
smoke and every static check).
