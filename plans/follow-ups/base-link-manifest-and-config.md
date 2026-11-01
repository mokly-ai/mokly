# Messages hide a linked base manifest or config

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-166-windows-paths-and-links`, outside the scope of
  review round 1.
- **Location:** `crates/mokly-catalogue/src/config_paths.rs:133` and `:231`,
  and `crates/mokly-catalogue/src/config.rs:40`.
- **Reason:** The two checks are outside the diff of the branch, and their
  messages depend on the rule that
  `plans/follow-ups/postcss-link-message-contract.md` asks the user to
  choose.

- **Terms:**
  - **Base tree:** the files of the Git base commit that Changes compares
    with the working tree. Mokly reads them through Git, which reports a
    symbolic link entry as a link and does not follow it.
  - **Link message:** the `config-invalid` message
    `{setting}: {value} uses the symbolic link {link}; name the target path instead`.
    `link_error` in `crates/mokly-catalogue/src/config_links.rs` builds it.
- **Background:**
  - Changes loads the configuration from the working tree and from the base
    tree. In the working tree a link resolves to its target. In the base
    tree a link entry has the kind `Symlink`.
  - On 2026-10-28 the user chose to keep the base failure of a root or
    package root through a link, and to name the link. The loader now gives
    the link message when the roots, package-root, renderer, local
    stylesheet, or PostCSS check fails at a link.
  - `has_manifest` at `crates/mokly-catalogue/src/config_paths.rs:231`
    accepts a package root only when its `package.json` is a regular file.
    A `package.json` that is a link entry in the base commit fails at line
    133 with
    `moduleResolution.packageRoots[{index}]: {path} must contain package.json`.
  - `crates/mokly-cli/src/changes_base.rs:48` loads the base configuration
    with `Loader` over the base tree. When the base tree has no file at the
    configuration path, line 50 uses an empty base configuration instead.
  - `Loader::load` projects the configuration file at
    `crates/mokly-catalogue/src/config.rs:37`. A `mokly.config.json` that is
    a link entry in the base commit fails at line 40 with
    `{file} must be a regular JSON file`.
  - Neither message names the link. No protocol page states either message.
- **Problem:** A base commit that holds `package.json` or `mokly.config.json`
  as a symbolic link fails without the name of the link. The user must find
  the link without help.
- **Impact if no action:** Changes stays unavailable with a message that
  points to a different cause, such as a missing `package.json`.
- **Root question:** How does a user learn which link breaks the base
  configuration when the link is a manifest or the configuration file?
- **Options:**
  - **A.** Change nothing. The two messages stay as they are. Effort: Small.
  - **B.** Call `link_error` when the two checks fail, so that both give the
    link message when a link is on the path. Effort: Small.
  - **C.** Make the projection of the base tree return the first link on a
    path. Then every check of the configuration can name the link without a
    call of its own. Effort: Medium.
- **Left out:** Follow links in the base tree. It reverses the 2026-10-28
  decision.
- **Wider fix:** C. The link then reaches every failed check of the
  configuration, also a check that a later change adds.
- **Previous examples:** Before the 2026-10-28 fix, the roots and package
  root checks failed at a base link with `must be a directory` or
  `does not exist`. Those messages did not name the link.
- **Related:**
  [postcss-link-message-contract.md](./postcss-link-message-contract.md)
  asks which configured paths name an unresolved link in the base tree. The
  fix of this item depends on its answer.
- **Recommendation:** B. It gives the two failures the same message as the
  other checks of the configuration, with two small calls.
- **Action:** ask the user, because the fix depends on the answer to
  `postcss-link-message-contract.md`, and it changes two user-visible
  messages that no requirement covers.
