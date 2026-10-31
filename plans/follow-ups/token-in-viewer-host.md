# Protect tokens in viewer URL hosts

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 178, delta review 3.
- **Location:** `crates/mokly-publish/src/completion.rs:69`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Viewer URL:** the optional `viewerUrl` in the catalogue service's
    Complete response, which `mokly publish` prints after an upload.
- **Background:** `completion.rs` parses the viewer URL. It drops a URL
  whose scheme is not `http` or `https`, that has no host, or that contains
  the publish token. `token.matcher().contains_url(&url)` runs on the parsed
  URL. URL parsing lowercases the host first.
- **Problem:** A token with upper-case letters in the URL host survives the
  check in a lower-case form, because the matcher compares letter case. The
  old check had the same gap, and no test covers a token in the host.
- **Impact if no action:** A publication response can print a recognizable
  form of the token.
- **Root question:** How should the viewer URL check find the token in every
  form that the URL parser can produce?
- **Options:**
  - **A.** Match the token in the host without regard to letter case, and
    add a regression test. Effort: Small (estimate).
  - **B.** Reject any viewer URL whose host contains the token. This adds a
    rejection. Effort: Small (estimate).
- **Left out:** Matching the full URL without regard to case can redact
  unrelated text in a case-sensitive path.
- **Wider fix:** A. Case folding only for the host matches what the URL
  parser does.
- **Previous examples:** The check before the Rust rebuild had the same
  untested host gap.
- **Related:** [percent-secret-redaction.md](./percent-secret-redaction.md)
  is a second gap in what `SecretMatcher` and its callers recognize as the
  token. One branch can fix both in the publish crate.
- **Recommendation:** A. It closes the exposure without a new rejection.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6365).
