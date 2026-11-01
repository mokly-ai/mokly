# Support linked package roots in base trees

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 174, outside the scope of the W8 work.
- **Location:** `crates/mokly-compare/src/git_tree.rs:221` and
  `crates/mokly-git/src/tree.rs:97`.
- **Reason:** The plan recorded this item with no options, and the recommended
  option C changes the documented link rule of the base Git reader.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Package root:** a directory with a `package.json` that the
    configuration names in `packageRoots`, so that renders can resolve its
    modules.
  - **Base tree:** the files of the Git base commit, read from Git objects,
    which Changes renders as the previous side.
- **Background:**
  - The working tree reads files through the file system, which follows
    symbolic links.
  - Git stores a symbolic link as a blob with mode `120000`.
    `crates/mokly-git/src/tree.rs:97` reads that mode as `Mode::Symlink`,
    and `git_tree.rs:221` reports the entry as `FileKind::Symlink`.
  - On 2026-10-28 the user chose that a package root names only its
    lexically normalized path, under the path rule of the configuration
    contract.
  - The plan recorded no options. This item first wrote them.
- **Problem:** A package root that is a symbolic link, or goes through one,
  loads in the working tree but fails in the base tree.
- **Impact if no action:** Changes can fail for a catalogue that builds from
  the working tree.
- **Root question:** How do the working tree and the base tree treat a
  linked package root alike?
- **Options:**
  - **A.** Document that package roots cannot use symbolic links. Effort:
    Small.
  - **B.** Resolve the package-root paths before both the working and the
    base reads. This changes the root that the configuration names, against
    the lexical path rule that the user chose on 2026-10-28. Effort: Medium.
  - **C.** Teach the base tree to follow symbolic links inside the
    repository, with cycle and escape checks. Effort: Medium.
- **Left out:** Follow links that leave the repository. It breaks the
  confinement of base sources.
- **Wider fix:** C. The base tree then follows Git link semantics for every
  file, not only for package roots.
- **Previous examples:** The same config-relative path review found a
  linked renderer and a linked repository root.
- **Related:**
  - [linked-renderer-stylesheet-root.md](linked-renderer-stylesheet-root.md)
    is the linked renderer case. It shares the link class, so one branch can
    settle the link rules together.
  - [config-repository-root-symlink.md](config-repository-root-symlink.md)
    is the linked repository root case of the same class.
- **Recommendation:** C. It makes the base side match Git link
  semantics without changing the configured paths.
- **Action:** ask the user, because C makes the base Git reader follow links
  inside the repository, against the rule of
  `docs/protocol/mokly-source-protection.md:135` that it rejects a symbolic
  link, and no user decision covers that change.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6327).
