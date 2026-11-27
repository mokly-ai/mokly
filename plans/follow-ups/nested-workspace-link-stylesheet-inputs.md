# Built package CSS through a nested link fails

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-26, from the end-to-end test of Milestone 7 on branch `calummoore/mokly-source-package-override-jkum`.
- **Location:** `crates/mokly-css/src/resolver.rs:164`, `crates/mokly-graph/src/graph.rs:184`, and `crates/mokly-static/src/fingerprint.rs:195`.
- **Reason:** The same failure occurs on `origin/main` at `34ac2acef`, so it does not come from the source package override.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Nested workspace link:** a link to a workspace package in a `node_modules` folder below the repository root, such as `app/node_modules/@acme/ui`, which points to `packages/ui`.
  - **Static input check:** the check in `crates/mokly-static/src/fingerprint.rs` that reads each input of a build again before it writes the output.
- **Background:**
  - A catalogue under `app/` has `app/style.css` with `@import '@acme/ui/skin.css';`.
  - The package `@acme/ui` is linked at `app/node_modules/@acme/ui`. Its export `./skin.css` points to `./esm/skin.css`, a built file that Git ignores.
  - No layout maps `esm/` to a source folder, so the CSS resolver keeps the built file.
- **Problem:** `mokly build` fails with `[mokly/export-invalid] Inputs changed during the build: {repo}/node_modules/@acme/ui/esm/skin.css. Build again.` The stylesheet inputs name the file by its logical path `node_modules/@acme/ui/esm/skin.css`. The static input check looks for that path at the repository root, where no such file exists.
- **Impact if no action:** a catalogue whose CSS imports a built package stylesheet through a nested workspace link cannot build. A link at the root `node_modules`, which npm, Yarn and pnpm workspaces use by default, is not affected. A source file that a layout selects is not affected either, because its path is a repository path.
- **Root question:** how does the static input check find each stylesheet input that the CSS resolver reached through a `node_modules` link?
- **Options:**
  - **A.** Record the stylesheet input by its real repository path, `packages/ui/esm/skin.css`, when the link points into the repository. Effort: Medium.
  - **B.** Keep the logical path, and map it through the side's dependency roots in the static input check, as the dependency inputs already do for JavaScript. Effort: Medium.
- **Left out:** rejecting nested workspace links, because npm and pnpm can create them for a nested workspace root, and a rejection is a new build error.
- **Wider fix:** B, because every logical `node_modules` input then uses the same mapping, whatever reached it.
- **Previous examples:** the JavaScript dependency inputs map logical `node_modules` paths through `crates/mokly-graph/src/dependency_inputs.rs`.
- **Recommendation:** B. It reuses the mapping that JavaScript inputs already use.
- **Action:** fix after merge, apply B. The failure predates this change and needs its own reproduction test.
- **Done when:** a build whose CSS imports `@acme/ui/skin.css` through `app/node_modules/@acme/ui`, with `skin.css` only under a built folder that Git ignores, succeeds. A test in `crates/mokly-cli/tests` covers it.
