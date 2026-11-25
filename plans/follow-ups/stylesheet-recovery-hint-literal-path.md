# Vite recovery hints escape literal file paths

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 93.
- **Location:** `crates/mokly-graph/src/policy.rs:125`,
  `crates/mokly-model/src/routes.rs:42`, and
  `docs/protocol/mokly-imported-styles-errors.md:108`.
- **Reason:** It is a Rare product bug of Medium severity. The file stays
  private, and the author can type the literal path, so the branch that
  found it kept its scope.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Tailwind:** The stylesheet tool whose `@source not` directive removes
    matching files from its scan.
  - **Protected input:** A file that Mokly keeps private. A document that
    links it as a public file fails the build.
  - **Recovery hint:** The exclusion example at the end of a protected-target
    reason: `@source not "{relative-file}"`.
- **Background:**
  - A stylesheet plugin can report a file that it reads, under the Vite
    adapter or under PostCSS. Mokly makes that file a protected input. A
    document that links it as a public asset fails, and the reason gives a
    Tailwind exclusion with a path relative to the stylesheet.
  - `docs/protocol/mokly-imported-styles-errors.md:108` to line 113 gives
    the two protected-target rows for plugin reports.
    `{relative-file}` is the path from the directory of the offending
    stylesheet to the referenced file. It starts with `./` when neither `.`
    nor `..` starts it, and it uses POSIX separators. It is not a URL.
  - `@tailwindcss/vite` compiles each stylesheet with the directory of that
    stylesheet as its base, so `@source` resolves from there, at
    `node_modules/@tailwindcss/vite/dist/index.mjs:1`.
  - Tailwind 4.3.3 gives the quoted text to its scanner without decoding, at
    `node_modules/tailwindcss/dist/lib.js:32`.
  - The native scanner contains the brace-expansion and glob crates
    `bexpand-1.2.0`, `fast-glob-0.4.3`, and `globset-0.4.17`, in
    `node_modules/@tailwindcss/oxide-linux-x64-gnu/tailwindcss-oxide.linux-x64-gnu.node`.
    Nobody has checked a literal file name with glob characters such as
    `[`, `]`, `{`, `}`, `*`, or `?`.
  - Both denials take `relative_file` from one line,
    `crates/mokly-graph/src/policy.rs:126`. The PostCSS hint has had the
    defect since commit `d935e6a66`. Commit `212b877b6` reused it for Vite.
  - The URL function has seven call sites.
  - The lowest test level that fails without the change is a
    `FilePolicy::check` unit test in
    `crates/mokly-graph/src/_tests_/policy_paths_tests.rs`, for the Vite and
    the PostCSS denial. The Node build test at
    `tests/vite_stylesheets.test.ts:168` is a higher level.
- **Problem:** Rust builds the exclusion with a URL encoder. For a file named
  `team logo.html`, it suggests `../content/team%20logo.html`. Tailwind uses
  the quoted text as a file pattern, so the suggested exclusion misses that
  file.
- **Screenshot:** In the build terminal, mark the escaped file name in the
  `@source not` hint for a reported file with a space.
- **Impact if no action:** The build keeps failing after the author copies
  the suggested exclusion.
- **Root question:** How can the build error give the author an exclusion
  that matches the reported file?
- **Options:**
  - **A.** Compute the literal relative path at the error site. Add a
    reported file name with a space to the existing Vite protection test.
    This leaves a second computation of the relative path. Effort: Small.
  - **B.** Share the computation of the relative path. Encode its result only
    in the URL function, and use the literal form for both stylesheet
    recovery messages. Add the regression as a `FilePolicy::check` unit test
    for the Vite and the PostCSS denial. Effort: Small.
  - **C.** Let each stylesheet compiler supply its own relative recovery path
    with the reported dependency. This carries a second path through the
    stylesheet pipeline. Effort: Medium.
  - **D.** Do B, and check Tailwind's pattern syntax once:
    - With the installed Tailwind 4.3.3, write `@source not` for a literal
      file name that has `[`, `]`, `{`, or `}`. See whether the scanner still
      reports that file. Save the output under `.context/`.
    - If the literal name matches, D ends as B with the saved proof.
    - If it does not match, escape those characters as Tailwind's syntax
      needs. Add a `FilePolicy::check` unit test with such a name. Add the
      escape rule to the `{relative-file}` definition in the same change.
    - Risk: the hint then depends on Tailwind's pattern rules, which can
      change between versions and platforms.
    - Effort: Medium.
- **Left out:**
  - Remove the exclusion example. It fails the goal, because the author loses
    the exclusion to copy.
  - A repository-relative path in the hint. B is better on every point,
    because the author must rewrite such a path relative to the stylesheet.
  - A typed URL value in `mokly-model` is not a real choice. The cause was
    that no literal relative-path function existed, so the policy took the
    URL function. A type change would touch the seven URL call sites for one
    diagnostic caller.
- **Wider fix:** B. A later diagnostic then finds a literal path function
  beside the URL function. Explicit names, such as `relative_path` and
  `relative_url`, make that choice visible. D is a direct fix, because it
  must know which characters Tailwind treats as special.
- **Previous examples:** The PostCSS recovery message uses the same URL
  helper, since commit `d935e6a66`.
- **Recommendation:** B. It fixes every name that URL encoding changes, at
  Small effort. The extra step of D pays off only if a one-time Tailwind
  check shows that a literal file name with glob characters does not match.
- **Action:** fix after merge, apply B, because the bug is Rare, the file
  stays private, and the author can type the literal path.
