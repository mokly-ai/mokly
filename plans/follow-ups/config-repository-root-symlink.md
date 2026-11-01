# One path rule for a linked repository root

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #240 and its completed plan, which put the
  problem outside the scope of its first review.
- **Location:** `crates/mokly-catalogue/src/config.rs:144` and
  `crates/mokly-catalogue/src/config_paths.rs:202`.
- **Reason:** The two checks are older than PR #240, and the review found the
  difference outside the diff of that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`repoRoot`:** the configuration field that names the repository root.
    Every configured path must stay inside it.
  - **Lexical path:** a path as written, after `.` and `..` segments are
    removed, without following symbolic links. The link target is the path
    that the file system resolves.
- **Background:**
  - PR #240, merged on 2026-10-28, gave config-relative paths one normalized
    form for the renderer, the PostCSS module, package roots, and local
    stylesheets.
  - `crates/mokly-catalogue/src/config.rs:144` checks each `roots[].dir`.
  - `crates/mokly-catalogue/src/config_paths.rs:202` checks the other path
    fields.
  - The review of PR #240 found on 2026-10-28 that, when `repoRoot` goes
    through a symbolic link, `roots[].dir` is checked against the lexical
    link path. The other fields are checked against the link target.
- **Problem:** Two fields of one configuration use two containment rules. A
  directory can then pass the check of one field and fail the check of
  another.
- **Impact if no action:** A repository at a linked path can get an
  "is outside repoRoot" error for one field and not for another, or accept
  paths that the other rule rejects.
- **Root question:** How does every configured path use one containment rule
  when `repoRoot` goes through a symbolic link?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Check `roots[].dir` against the link target, as the other fields
    are. Effort: Small.
  - **C.** Reject a `repoRoot` that goes through a symbolic link, with a
    configuration error. This adds a rejection. Effort: Small.
  - **D.** Move the containment check of every configured path into one
    helper that both files call, with the rule of B. Effort: Medium.
- **Left out:** Checking every field against the lexical path only. A link
  inside the repository could then reach files outside the target, which
  breaks confinement.
- **Wider fix:** D. One helper keeps every field on one rule.
- **Previous examples:** PR #240 replaced four separate joins of the authored
  spelling with one normalized form on 2026-10-28.
- **Related:**
  - [linked-renderer-stylesheet-root.md](./linked-renderer-stylesheet-root.md)
    is the second linked-path problem that the same review found. It loses
    a renderer's styles when the renderer path goes through a link.
  - [base-symlink-package-root.md](./base-symlink-package-root.md) concerns
    linked package roots in the base tree of Changes. It is the same class
    of link handling in another reader.
- **Recommendation:** D. It fixes the difference and keeps every
  later field on the same rule.
- **Action:** fix after merge, apply D, because the inconsistent
  check is a product bug outside the reviewed diff, and D is not blocked.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/normalize-config-relative-paths.md?plain=1#L322).
