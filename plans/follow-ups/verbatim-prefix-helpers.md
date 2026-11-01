# Two helpers strip the Windows verbatim prefix

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-166-approved-windows-paths`. The first review of the
  Windows path work put it outside the scope.
- **Location:** `crates/mokly-source-interface/src/identity_evidence.rs:8`
  and `crates/mokly-compare/src/locations.rs:57` to line 92.
- **Reason:** The second helper is outside the diff of the branch, and both
  helpers agree on the drive and network paths that the code meets today.

- **Terms:**
  - **Verbatim prefix:** the `\\?\` start of a Windows path, as in
    `\\?\C:\repo`, or `\\?\UNC\server\share\repo` for a network path.
  - **Plain form:** the same path without the verbatim prefix, such as
    `C:\repo` or `\\server\share\repo`.
  - **Opened-file witness:** a `FileIdentity` from
    `crates/mokly-source-interface/src/read_evidence.rs:8`. A child process
    reports it for a file that it opened, with an optional canonical name.
- **Background:**
  - `comparable` at `crates/mokly-source-interface/src/identity_evidence.rs:8`
    is private. `matches` at line 18 uses it to compare the canonical name
    of an opened-file witness with the identity of the current node.
  - `comparable` works on the text of the path, through `to_string_lossy`,
    on every platform. It replaces a `\\?\UNC\` start with `\\`, and it
    removes any other `\\?\` start.
  - `plain` at `crates/mokly-compare/src/locations.rs:57` to line 87 is
    private too. `inside_repository` at line 90 uses it to check that the
    base cache is outside the repository.
  - On Windows, `plain` works on path components. It converts a verbatim
    drive prefix and a verbatim network prefix to their plain forms, and it
    keeps every other prefix. On other platforms it returns the path
    unchanged.
  - The two rules differ today. `comparable` removes the prefix of a volume
    path, such as `\\?\Volume{01234567-89ab-cdef-0123-456789abcdef}\repo`.
    `plain` keeps it, and `crates/mokly-compare/src/_tests_/locations_tests.rs:78`
    asserts that. `comparable` also compares non-UTF-8 paths after a lossy
    conversion.
  - The test at
    `crates/mokly-source-interface/src/_tests_/identity_evidence_tests.rs:27`
    checks the drive and network spellings on every platform, so it depends
    on the text rule.
  - `mokly-compare` already depends on `mokly-source-interface`.
- **Problem:** One rule, the plain form of a Windows path, has two
  implementations with different edge cases. A change to one of them does
  not reach the other.
- **Impact if no action:** The two checks can come to disagree about the same
  path. Each new copy of the rule adds one more place to keep in step.
- **Root question:** How do all Mokly checks that compare Windows paths use
  one rule for the verbatim prefix?
- **Options:**
  - **A.** Change nothing. Both checks work for the drive and network paths
    that the code meets today. Effort: Small.
  - **B.** Make one public helper in `mokly-source-interface`, with one rule
    for every prefix kind and one table test. Use it in `matches` and in
    `inside_repository`, and delete the two private helpers. Choose whether
    the rule runs on every platform, as `comparable` does, or on Windows
    only, as `plain` does. Effort: Small.
  - **C.** Create every canonical identity in the plain form, in the Rust
    source trees and in the child processes that report opened files. Then
    no check compares two forms. Effort: Large.
- **Left out:** Use `dunce::simplified` in both checks. It converts only a
  drive path that is safe to convert. A network path or a long path keeps
  its prefix, so both checks then miss it.
- **Wider fix:** B. One shared helper is then the only rule, and a new check
  uses it. C goes further and removes mixed forms at their source, but it is
  Large.
- **Previous examples:** None found.
- **Related:** [windows-canonical-paths.md](./windows-canonical-paths.md)
  asks for a lint against the standard canonicalize, which returns the
  verbatim form. Both items have the same cause.
- **Recommendation:** B. One helper keeps the two checks on one rule with a
  small change.
- **Action:** fix after merge, apply B, because it changes
  `mokly-source-interface`, which is outside the diff of the branch, and both
  checks work today.
