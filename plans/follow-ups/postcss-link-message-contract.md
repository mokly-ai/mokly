# Base link messages exceed their recorded contract

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from branch
  `conductor/rust-rebuild-166-windows-paths-and-links`, review findings 1
  and 3. On 2026-11-01 review round 3, finding 5, merged in as a repeat.
  On 2026-11-01 review round 4, finding 6, merged in as a repeat.
- **Location:**
  - `crates/mokly-catalogue/src/config_postcss.rs:48` and `:61`.
  - `crates/mokly-catalogue/src/config_paths.rs:195` and `:211`.
  - `crates/mokly-catalogue/src/config.rs:101`.
  - `crates/mokly-catalogue/src/config_links.rs:37`.
  - `crates/mokly-catalogue/src/_tests_/config_postcss_tests.rs:122`.
  - `crates/mokly-catalogue/README.md:24` and `:28`.
  - `docs/protocol/mokly-imported-styles-errors.md:18`.
  - `docs/protocol/mokly-root-discovery.md:11`.
  - `docs/protocol/mokly-configuration.md:63`.
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
  - **Configured filesystem field:** a configuration field that names a
    path. The "Shape" section of `docs/protocol/mokly-configuration.md` lists
    six: `repoRoot`, `roots[].dir`, `renderer`, `postcss`, package roots, and
    local stylesheets.
  - **Required file:** a file that the base configuration needs and that no
    setting names: the `package.json` of a package root, or the
    configuration file itself.
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
  - Every option below keeps that base failure and does not follow links.
    The reason of the answer still holds: the base extraction holds regular
    files only.
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
  - So five settings name the link today: `roots[].dir`, package roots, the
    renderer, local stylesheets, and `postcss`. No user decision covers the
    renderer, local stylesheets, and `postcss`. The branch added them after
    the 2026-10-28 answer.
  - A linked `repoRoot` gets `repoRoot must name an existing directory`, at
    `crates/mokly-catalogue/src/config.rs:101`, with no link name. Such a
    layout reaches the base tree. For example, `tools/mokly.config.json` sets
    `repoRoot` to `root`, and `tools/root` is a link to the repository root.
    The working tree and the Git boundary accept that layout.
  - Row 18 of the error catalogue gives one exact message for a missing or
    non-file `postcss` module:
    `postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: {config-path}`.
    With a link in the base tree, both PostCSS branches return the link
    message instead.
  - For example, with `postcss: "../postcss.mjs"` and a Git link entry at
    `postcss.mjs`, the code gives
    `postcss: ../postcss.mjs uses the symbolic link postcss.mjs; name the target path instead`.
    The error catalogue requires
    `postcss module must be an existing regular .ts, .mts, .js, .mjs or .cjs file inside repoRoot: ../postcss.mjs`.
  - The "Shape" section at `docs/protocol/mokly-configuration.md:63` gives
    one path rule for every configured filesystem field, `repoRoot`
    included. So a link rule "for every configured path" includes
    `repoRoot`, and the code names no `repoRoot` link. Each option below
    therefore names its settings exactly.
  - `crates/mokly-catalogue/README.md:24` to line 26 says that a configured
    path through a symlink fails in the base tree, and that the message names
    the symlink. A linked `repoRoot` gets no link name, so the sentence
    overstates the code.
  - `crates/mokly-catalogue/README.md:28` to line 29 says that the PostCSS
    path, suffix, and regular-file checks use the catalogued `config-invalid`
    diagnostics. With a link in the base tree, they do not. Each option below
    makes that sentence true again.
  - Each option sets a different README text, so the README edit lands with
    the answer.
  - A test gap depends on the answer. The test
    `a_linked_postcss_module_names_the_link` at
    `crates/mokly-catalogue/src/_tests_/config_postcss_tests.rs:122` covers a
    module that is itself a link, the branch at line 61. No test covers a
    module below a link, the branch at line 48.
  - The missing case of
    `missing_non_file_and_physical_escape_have_the_catalogued_diagnostics`
    has no link. No case of `crates/mokly-compare/tests/linked_roots_tests.rs`
    sets `postcss`. So a removal of the call at line 48 fails no test.
  - The answer settles the expected message of that test. The direct case
    can go in the unit tests of `config_postcss_tests.rs` or in
    `linked_roots_tests.rs`, which runs Git.
  - The PostCSS check and `confined` each call `link_error` twice: once for
    a missing path and once for a path of the wrong kind. A shared typed
    projection helper, which reports a file, a missing path, or an
    unresolved link, would let no check lose the link case.
- **Problem:** For a PostCSS module through a link in the base tree, the code
  and the error catalogue give two different exact messages. No requirement
  says which settings name the link, apart from roots and package roots. The
  catalogue README promises a link name that a linked `repoRoot` does not
  get.
- **Impact if no action:** A review cannot tell which side is right, so the
  conflict stays. A later change can drop the link message from the three
  settings, and no requirement or test catches it.
- **Root question:** Which base-validation failures at an unresolved symbolic
  link must name the link?
- **Options:**
  - **A.** Keep the five link messages. Add the link message to row 18 of
    the error catalogue. Widen the root discovery sentence to the five
    settings. Narrow the sentence at `crates/mokly-catalogue/README.md:24` to
    the five settings. Add the missing PostCSS test, and make each check call
    `link_error` once. Effort: Small.
  - **B.** Restore the catalogued PostCSS message, and keep the other four
    link messages: roots, package roots, the renderer, and local
    stylesheets. State the rule for those four settings in the "Shape"
    section of `docs/protocol/mokly-configuration.md`, as C does for five.
    Narrow the README sentence to those four settings. The PostCSS test gap
    then closes. B still makes PostCSS the only exception, with a message
    that hides the cause, so C still ranks above B. Effort: Small.
  - **C.** Keep the five link messages. State one rule for exactly these five
    settings in the "Shape" section of the configuration page, and point the
    root discovery sentence to it. Add the link message to row 18 of the
    error catalogue. Narrow the README sentence to the five settings. Add the
    missing PostCSS test, and make each check call `link_error` once. Effort:
    Small.
  - **D.** Name the link for roots and package roots only. Restore the
    earlier messages of the other three settings:
    `{setting}: {value} does not exist` and
    `{setting}: {value} must be a regular file` for the renderer and local
    stylesheets, and the catalogued message for `postcss`. Narrow the README
    sentence to roots and package roots. The PostCSS test gap then closes.
    Effort: Small.
  - **E.** Keep every catalogued and earlier message, and name the link on a
    separate detail line of the "base validation failed" result. The loader
    error carries the failing repository path, and the Changes base side
    runs the link walk on it. One place then covers every setting and
    required file, and no catalogue row changes. It reverts the five link
    messages. It changes the root discovery sentence and
    `docs/protocol/mokly-base-preparation.md`. It departs from the
    2026-10-28 words "in the loader message". The catalogue README drops its
    link sentence, and the README of the crate that builds the detail line
    describes it. Effort: Medium.
  - **F.** Apply C, and name the link for `repoRoot` too. One rule then
    covers every configured filesystem field, and the README sentence
    becomes true as written. The `repoRoot` walk starts at the working
    directory of the loader, which the base side sets to the repository
    root. It adds a requirement for a rare layout. Effort: Small.
- **Left out:**
  - Change nothing. It keeps the conflict between the code and the error
    catalogue, and the README claim that the code does not meet.
  - Follow links in the base tree. It reverses the 2026-10-28 decision.
  - Generate the error catalogue from the code. It does not settle which
    text is right.
  - Report the first link from the projection of the base tree. Link checks
    in the loader reach the same failures, as F and
    `plans/follow-ups/base-link-manifest-and-config.md` show. They leave the
    other readers of the tree alone: discovery, the public closure, and
    render.
  - Append the link to the catalogued PostCSS text. It still changes the
    exact text, and it adds a second link format.
  - Reject a configured path through a link in both trees. It breaks the
    rule that the working tree resolves links, and it removes layouts that
    work on `main`.
  - Narrow the README before the answer. Each option sets a different README
    text, so the edit must wait.
  - Name the link for every configured path and every required file in one
    change. F covers every configured filesystem field, and
    `plans/follow-ups/base-link-manifest-and-config.md` covers the required
    files. The two answers together give the same result.
- **Wider fix:** None beyond the rule in force. The `documentation` skill,
  which `AGENTS.md` names, requires the code and its contract to change
  together. The structural link check for each validation check stays with
  `plans/follow-ups/base-link-manifest-and-config.md`, as its option E.
- **Previous examples:**
  - PR #240, commit `843ac8bf`, changed PostCSS messages and their catalogue
    rows together.
  - The review of the PostCSS port in the Rust rebuild found tests that
    missed the path that it fixed.
- **Related:**
  [base-link-manifest-and-config.md](./base-link-manifest-and-config.md)
  names required files that fail in the base tree without the name of a
  link. Its fix waits for the answer to this item. Option E also covers
  those files.
- **Recommendation:** C. It keeps the clearer message at Small cost, and it
  names its five settings exactly. F is the choice for one rule with no
  exception.
- **Action:** ask the user, because C adds requirements for three settings
  that the 2026-10-28 answer does not cover, and it changes an exact
  protocol message.
