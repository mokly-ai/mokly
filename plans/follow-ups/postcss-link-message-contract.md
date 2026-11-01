# PostCSS link message conflicts with the error catalogue

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-166-windows-paths-and-links`, review findings 1
  and 3.
- **Location:** `crates/mokly-catalogue/src/config_postcss.rs:48` and `:61`,
  `crates/mokly-catalogue/src/config_paths.rs:195` and `:211`,
  `crates/mokly-catalogue/src/config_links.rs:37`,
  `crates/mokly-catalogue/src/_tests_/config_postcss_tests.rs:122`,
  `docs/protocol/mokly-imported-styles-errors.md:18`,
  `docs/protocol/mokly-root-discovery.md:11`, and
  `docs/protocol/mokly-configuration.md:63`.
- **Reason:** The branch gives the link message to three settings that the
  2026-10-28 answer does not cover, so the user chooses the rule for them.

- **Terms:**
  - **Base tree:** the files of the Git base commit that Changes compares
    with the working tree. Mokly reads them through Git, which reports a
    symbolic link entry as a link and does not follow it.
  - **Link message:** the `config-invalid` message
    `{setting}: {value} uses the symbolic link {link}; name the target path instead`.
    `link_error` in `crates/mokly-catalogue/src/config_links.rs` builds it.
  - **Error catalogue:** `docs/protocol/mokly-imported-styles-errors.md`,
    the protocol page that gives the exact message of each imported
    stylesheet failure.
- **Background:**
  - Changes loads the configuration from the working tree and from the base
    tree. The working tree follows symbolic links. The base tree does not, so
    a configured path through a link fails there with `config-invalid`.
  - On 2026-10-28 the user answered: "Keep the failure, and name the link in
    the loader message, with one sentence on the root discovery page." The
    answer rejected following links in the base tree. The case is Low with
    no known user, and Git for Windows checks out links as plain files by
    default. Following links is Large and partial, with no JavaScript below
    a linked root.
  - The sentence at `docs/protocol/mokly-root-discovery.md:11` states the
    rule for roots and package roots only. The 2026-10-28 answer covers
    those two settings.
  - Three checks call `link_error` after they fail:
    - The roots check at `crates/mokly-catalogue/src/config.rs:140`.
    - `confined` in `crates/mokly-catalogue/src/config_paths.rs`, at line
      195 for a missing path and line 211 for a path of the wrong kind. It
      checks the renderer, local stylesheets, and package roots.
    - The PostCSS check in `crates/mokly-catalogue/src/config_postcss.rs`, at
      line 48 for a missing module and line 61 for a module that is not a
      regular file.
  - So the renderer, local stylesheets, and the PostCSS module get the link
    message too. No user decision covers these three settings.
  - Row 18 of the error catalogue gives one exact message for a missing or
    non-file `postcss` module:
    `postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: {config-path}`.
    With a link in the base tree, both PostCSS branches return the link
    message instead.
  - The "Shape" section of the configuration page, at
    `docs/protocol/mokly-configuration.md:63`, gives one path rule for every
    filesystem field. The fields are `repoRoot`, `roots[].dir`, `renderer`,
    `postcss`, package roots, and local stylesheets.
  - A test gap depends on the answer. The test at
    `crates/mokly-catalogue/src/_tests_/config_postcss_tests.rs:122` covers a
    PostCSS module that is itself a link. No test covers a module that lies
    below a link, which reaches the branch at `config_postcss.rs:48`.
  - The PostCSS check and `confined` each call `link_error` twice: once for
    a missing path and once for a path of the wrong kind.
- **Problem:** For a PostCSS module through a link in the base tree, the code
  and the error catalogue give two different exact messages. No requirement
  says which configured paths name the link, apart from roots and package
  roots.
- **Impact if no action:** A review cannot tell which side is right, so the
  conflict stays. A later change can drop the link message from the three
  settings, and no requirement catches it.
- **Root question:** Which configured paths must name an unresolved symbolic
  link when they fail in the base tree?
- **Options:**
  - **A.** Keep every new message. Add the link message for `postcss` to
    the error catalogue beside row 18. Widen the root discovery sentence to
    every configured path. Add the test for a PostCSS module below a link,
    and make each check call `link_error` once. Effort: Small.
  - **B.** Restore the catalogued message in the PostCSS check, and keep the
    other new messages. The PostCSS test gap then closes, because the
    PostCSS check no longer names a link. Effort: Small.
  - **C.** Keep every new message. State one rule for every configured path
    in the "Shape" section of the configuration page, and point the root
    discovery sentence to it. Add the link message for `postcss` to the
    error catalogue beside row 18. Add the test for a PostCSS module below a
    link, and make each check call `link_error` once. Effort: Small.
  - **D.** Name the link for roots and package roots only. Restore the
    earlier messages of the other three settings:
    `{setting}: {value} does not exist` and
    `{setting}: {value} must be a regular file` for the renderer and local
    stylesheets, and the catalogued message for `postcss`. The PostCSS test
    gap then closes. Effort: Small.
- **Left out:**
  - Change nothing. It keeps the conflict between the code and the error
    catalogue.
  - Follow links in the base tree. It reverses the 2026-10-28 decision.
  - Generate the error catalogue from the code. It does not settle which
    text is right.
- **Wider fix:** C. One rule for every configured path sits beside the path
  rule of every filesystem field, so a new path field follows it too.
- **Previous examples:** PR #240, commit `843ac8bf`, changed PostCSS messages
  and their catalogue rows together.
- **Related:**
  [base-link-manifest-and-config.md](./base-link-manifest-and-config.md)
  names two more base-tree failures that do not name a link. Its fix depends
  on the answer to this item.
- **Recommendation:** C. One rule on the configuration page covers all five
  settings that the code covers, and the error catalogue then matches the
  code.
- **Action:** ask the user, because the recommended option adds a
  requirement for three settings, and the 2026-10-28 answer covers only roots
  and package roots.
