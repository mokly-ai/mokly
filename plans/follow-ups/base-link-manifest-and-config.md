# Base links hide required files without naming them

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-166-windows-paths-and-links`, outside the scope of
  review round 1. On 2026-11-01 the finding check of review round 3,
  finding 5, merged in a problem of the same class: a configuration file
  below a link.
- **Location:**
  - `crates/mokly-catalogue/src/config_paths.rs:133` and `:231`.
  - `crates/mokly-catalogue/src/config.rs:40`.
  - `crates/mokly-cli/src/changes_base.rs:50`.
  - `docs/protocol/mokly-catalogue-changes.md:3`.
- **Reason:** The three cases are outside the diff of the branch, and their
  fix depends on the rule that
  `plans/follow-ups/postcss-link-message-contract.md` asks the user to
  choose.

- **Terms:**
  - **Base tree:** the files of the Git base commit that Changes compares
    with the working tree. Mokly reads them through Git, which reports a
    symbolic link entry as a link and does not follow it.
  - **Link message:** the `config-invalid` message
    `{setting}: {value} uses the symbolic link {link}; name the target path instead`.
    `link_error` in `crates/mokly-catalogue/src/config_links.rs` builds it.
  - **Required file:** a file that the base configuration needs and that no
    setting names: the `package.json` of a package root, or the
    configuration file itself.
- **Background:**
  - Changes loads the configuration from the working tree and from the base
    tree. In the working tree a link resolves to its target. In the base
    tree a link entry has the kind `Symlink`, and a path below a link entry
    is missing.
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
    with `Loader` over the base tree. Line 50 projects the path of the
    working configuration file. `Loader::load` set that path at
    `crates/mokly-catalogue/src/config.rs:37` to the working-tree identity,
    with links resolved.
  - `Loader::load` projects the configuration file at
    `crates/mokly-catalogue/src/config.rs:37`. A `mokly.config.json` that is
    a link entry in the base commit fails at line 40 with
    `{file} must be a regular JSON file`.
  - When the projection at line 50 of `changes_base.rs` finds no file, lines
    51 to 56 use an empty base configuration. The rule at
    `docs/protocol/mokly-catalogue-changes.md:3` is: "A base commit without
    the selected configuration file has an empty catalogue. Every current
    entry is added."
  - A directory on that path can be a link entry in the base commit. For
    example, the base commit has `config` as a link, and the head replaced
    it with a real directory that holds `mokly.config.json`. The base tree
    then reports the file as missing. Changes lists every current entry as
    added, and it names no link.
  - Neither failure message names the link, and no protocol page states
    either message.
  - The advice of the link message, "name the target path instead", does
    not fit a required file, because no setting names it. A required file
    needs a second message form.
- **Problem:** A base commit that holds `package.json` or `mokly.config.json`
  as a symbolic link fails without the name of the link. A configuration
  file below a link in the base commit gives an empty base catalogue with no
  message. The user must find the link without help.
- **Impact if no action:** Changes stays unavailable with a message that
  points to a different cause, such as a missing `package.json`. Or it lists
  every current entry as added, with no reason.
- **Root question:** How does a user learn that a symbolic link in the base
  commit hides a required file?
- **Options:**
  - **A.** Change nothing. The two messages and the empty base catalogue
    stay. Effort: Small.
  - **B.** Name the link in the manifest and configuration-file failures,
    with a second message form for a required file. Before line 50 of
    `changes_base.rs` uses an empty base configuration, walk the
    configuration path. Fail base validation with that message when a link
    is on it. The empty-catalogue rule then excludes a file below a link.
    Effort: Medium.
  - **D.** Name the link in the two failures, as in B. For a configuration
    file below a link, keep the empty base catalogue, and add a warning that
    names the link. Every current entry then still shows as added. Effort:
    Medium.
  - **E.** Share one typed projection helper that reports a file, a missing
    path, or an unresolved link. Use it in every check of the loader and at
    line 50 of `changes_base.rs`. Each case then names the link without a
    call of its own. Effort: Medium.
- **Left out:**
  - **C.** Make the projection of the base tree return the first link on a
    path. A change of the tree also alters discovery, the public closure,
    and render. Link checks in the loader reach the same failures, as B and
    E show.
  - Follow links in the base tree. It reverses the 2026-10-28 decision.
- **Wider fix:** E. One helper gives every check, also a later one, the
  link case.
- **Previous examples:** Before the 2026-10-28 fix, the roots and package
  root checks failed at a base link with `must be a directory` or
  `does not exist`. Those messages did not name the link.
- **Related:**
  [postcss-link-message-contract.md](./postcss-link-message-contract.md)
  asks which base-validation failures at an unresolved link must name the
  link. The fix of this item waits for its answer. Its option E, a detail
  line of the base validation result, also covers these files.
- **Recommendation:** B. A file below a link makes the base catalogue wrong,
  so a failure that names the link serves the user better than a wrong
  result. E best protects the codebase, because no check can then miss the
  link case.
- **Action:** ask the user, because the fix depends on the answer to
  `postcss-link-message-contract.md`, and it changes two messages and the
  empty-catalogue rule of `docs/protocol/mokly-catalogue-changes.md:3`.
