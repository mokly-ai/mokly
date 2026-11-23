# Authored file failures answer as render failures

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-23, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 2:
  a problem that the checks of findings 11 and 13 found in the authored path.
  On the same day it moved out of
  `plans/follow-ups/authored-requests-need-temporary-space.md`, so that each
  item holds one root question.
- **Location:** `crates/mokly-server/src/application.rs` (the `static/`
  branch of `route`), `crates/mokly-cli/src/serve_errors.rs` (`internal`),
  `crates/mokly-server/src/authored_assets.rs` (the capture that
  `AuthoredRequest::admit` runs), `crates/mokly-server/src/generated_routes.rs`
  (the error answer of a generated asset), the section "Serve Reads And The
  Static Output" of `docs/protocol/mokly-public-closure.md`, and the section
  "Rich Errors" of `docs/protocol/mokly-terminal-errors.md`.
- **Reason:** No protocol page states this answer, so its status and its text
  are a new requirement, which the user approves.

- **Source:** Review.
- **Category:** UX wording.
- **Terms:**
  - **Authored file:** a repository file of the public closure that a mockup
    references. Serve answers it at `/static/` followed by its closure path.
  - **Error envelope:** the JSON body of a Serve error answer, with a reason
    code and a text.
- **Background:**
  - When Serve cannot prepare an authored file, the capture returns an
    internal error, for example `InternalError::Io` when the temporary copy
    cannot be made or written. The `static/` branch of `route` in
    `crates/mokly-server/src/application.rs` then answers 500 with the reason
    `render-failed` and the text "The asset could not be rendered. Try
    again."
  - No render runs for an authored file, and a retry does not help when the
    temporary storage is full.
  - `internal` in `crates/mokly-cli/src/serve_errors.rs` shows
    `InternalError::Io` on the terminal as the raw OS error text, with no
    asset path and no `TMPDIR` hint.
  - On `origin/main`, `Work::authored` returned only the confined handle, so
    the authored route answered only 200 or 404. The branch added this error
    answer.
  - On `origin/main`, the generated asset route in
    `crates/mokly-server/src/generated_routes.rs` already sends the same
    answer, also when its verified temporary copy fails.
  - The protocol uses `render-failed` for a render that throws, in the error
    table of `docs/protocol/mokly-sidecar.md`. The section "Serve Reads And
    The Static Output" of `docs/protocol/mokly-public-closure.md` says that a
    missing, replaced, protected, or unlisted resource returns 404. No page
    states the answer when Serve cannot prepare a readable file. A new rule
    would go next to that 404 rule, and its terminal line into the terminal
    errors contract.
  - The section "Rich Errors" of `docs/protocol/mokly-terminal-errors.md`
    gives a precedent. When the publish build directory cannot be prepared,
    the plain line names the temporary root and says to set `TMPDIR`, or
    `TMP` on Windows, to a writable directory outside the checkout.
- **Problem:** The answer for a failed authored file names a render that does
  not run, and it asks for a retry that does not help. The terminal line
  gives no path and no action. No requirement states what Serve answers.
- **Impact if no action:** A developer whose temporary storage is full sees a
  render failure and an OS error. The developer does not learn which file
  failed or what to change.
- **Root question:** What status and what text should Serve give, in the
  answer and on the terminal, when it cannot prepare an authored file?
- **Options:**
  - **A.** Keep the status 500 and the reason `render-failed`. Change the text
    so that it names no render, and give the terminal line the asset path.
    Cost: the reason still names a render. Effort: Small.
  - **B.** Give a failed authored file its own reason, for example
    `asset-unavailable`, with a text that says that Serve could not prepare
    the file. Give the terminal line the asset path. Effort: Small.
  - **C.** B, with two error kinds. A failure of the temporary storage names
    the temporary root and says to set `TMPDIR`, or `TMP` on Windows, as the
    publish rule does. A failed read of the source names the file only.
    Effort: Small.
  - **D.** C for every file that Serve prepares: authored files and the
    verified copies of generated assets share the reason, the texts, and the
    terminal lines. Cost: it also changes the answer of generated assets that
    is on `origin/main`. Effort: Medium.
- **Shared assumptions:**
  - The status stays 500, because the failure is in Serve, not in the
    request. Source: the other Serve routes also answer an internal failure
    with the status 500. It stays.
- **Left out:**
  - Change nothing. The answer names a render that does not run.
  - 503 with a retry hint. A full temporary storage does not end on its own,
    so a retry does not help.
  - 404. The file exists and is readable, so 404 would hide the failure.
- **Wider fix:** D. One reason and one set of texts for every failed file
  preparation stop the routes from drifting apart.
- **Previous examples:** The failure of the publish build directory names the
  temporary root and gives the `TMPDIR` hint, under the terminal errors
  contract.
- **Related:** `plans/follow-ups/authored-requests-need-temporary-space.md`,
  the same failure. Its option B removes this failure for bodyless requests,
  so after that fix, this answer remains for a GET that needs a body. Its
  option C uses the same two error kinds as option C here.
- **Recommendation:** C. It names the real cause of each failure, and it
  gives the `TMPDIR` hint only when the temporary storage failed, as the
  publish rule does. D also aligns the generated assets, but it changes an
  answer that is on `origin/main`.
- **Action:** ask the user, because no requirement states the answer of the
  authored route, so its status and its text are new behaviour at a
  boundary.
