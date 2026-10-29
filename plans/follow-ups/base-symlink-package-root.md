# Support linked package roots in base trees

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** See the affected paths in the task below.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** Changes loads package roots from the working tree and the Git base tree. A package root can use a symbolic link.
- **Problem:** The working tree loads a linked package root. The base tree reports the same entry as a link and rejects it.
- **Impact if no action:** Changes can fail for a catalogue that builds from the working tree.
- **Root question:** How should Mokly support linked package roots in base trees?
- **Options:**
  - **A.** Document that package roots cannot use symbolic links. Effort: Small.
  - **B.** Resolve package-root paths before both working and base reads. Effort: Medium.
  - **C.** Teach the base tree to follow in-repository symbolic links with cycle and escape checks. Effort: Medium.
- **Left out:** Following links outside the repository breaks base-source confinement.
- **Wider fix:** C.
- **Previous examples:** The config-relative path review found the linked renderer and linked repository-root cases.
- **Recommendation:** C. It makes base behavior match Git link semantics without changing working paths.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6327).
