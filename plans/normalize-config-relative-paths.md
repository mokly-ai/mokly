# Normalize Config-Relative Paths

Status: Active. On branch
`conductor/rust-rebuild-167-normalize-config-relative-paths`, no pull request
yet. The plan closes when its PR merges.

This plan resolves user item 167 of the
[Rust rebuild plan](./rust-rebuild.md#open-user-items-deferred-by-the-user-on-2026-10-21),
and items 169 and 170, which option 167 B also fixes. It also resolves items
168 and 171, because they decide the same path rule for package roots. It
ticks items 172 and 182, which need no code here. The rebuild review W8
recorded items 167 to 174 on 2026-10-22.

`mokly.config.json` names the renderer, the PostCSS module, package roots,
and local stylesheets relative to the configuration file. The loader checks
the normalized path: the repository-relative path without `.`, `..`, or empty
segments. Four call sites in `mokly-render` join the authored spelling again
and keep those segments. So they disagree with the sidecar, the graph crate,
and the source inventory:

- A renderer spelled `../renderer.tsx` in a nested configuration, or
  `app/../renderer.tsx`, `lib/./renderer.tsx`, or `lib//renderer.tsx` in a
  root configuration, renders without its stylesheet. The build exits 0 with
  no warning. A comparison also misses an edit of that stylesheet, because
  both sides lack it.
- A configured stylesheet spelled `sub/../first.css` that a component also
  declares fails the build with "listed authoring input".
- A PostCSS module spelled `tools/../postcss.mjs` keeps that spelling in every
  `processCss` request, so the worker-disconnect message and the timeout label
  show it. The structured load failures already show `postcss.mjs`, because
  the worker names the module by its resolved path.

The probes on `main` at `89c12ef1` are in
`.context/normalize-config-relative-paths/probe-summary.md`.

Not covered: item 174, symbolic links in the base Git tree, which its own
change plans.

## Decisions

The user answered every decision on 2026-10-28, through the coordinator
workspace "rust rebuild - outstanding items". The coordinator's independent
reviewer kept every recommended option.

- 167 B: one public `ResolvedConfig` resolver for every config-relative path,
  read by every consumer, with the path rule in the configuration page.
  Rejected: A, normalize the renderer path at the two render call sites.
  Reason: one resolver also fixes 169 and 170, and the next consumer has no
  reason to join the authored spelling. `2261fa43` gave package roots the
  same fix after a High security finding.
- 169 B: `declarations.rs` reads the resolver. Rejected: A, a local
  normalization of the configured list.
- 170 B: the PostCSS module path comes from the resolver. Rejected: A, a
  local normalization before the sidecar call.
- 168 E: close it with 171 B. Rejected: A to D as recorded. Reason: under
  the lexical rule both roots are valid, and without the aliases the output
  boundary no longer projects `file.txt/../ui/package.json`.
- 171 B: package roots use only the normalized root, and the aliases go. The
  user approved this removal of behaviour that is on `main`. Rejected: A,
  keep the aliases and state the exception; C, reject such a spelling with a
  new message. Reason: the loader, the graph crate, and the sidecar already
  read the renderer, the PostCSS module, and stylesheets lexically, so B
  gives every field one rule.
- 182 C: one function builds the ancestor and package-root list for both
  sides. [PR #227](https://github.com/mokly-ai/mokly/pull/227) does it in
  `ad86ebb7` with `ancestor_roots::package_roots`, which `side::inputs` and
  `dependencies::package_roots` call. This plan changes no code for 182. It
  ticks 182 in Milestone 6 after #227 merges, because #227 does not name the
  item. Rejected: A, remove duplicates on the head side only; B,
  `package_roots()` without duplicates, which misses the recorded example.
- 174 A: its own change, which the workspace "rust rebuild: 166 Windows
  paths and links" plans. Rejected: B, add it to this plan.
- 172 A: keep the convention of comparing `Path` values. The tests of this
  plan follow it, and Milestone 3 ticks 172. Rejected: B, a shared helper in
  a new test crate.

### Order of work

PRs #227 and #228 change some files of Milestone 3. Milestones 1, 2, 4, and
5 come first. The PostCSS part of Milestone 3 follows #228, which merged on
2026-10-28. The renderer part waits for #227, which moves the renderer
computation in `mokly-render/src/graph.rs` and digests the bundle's renderer
path in `render_environment.rs`. The renderer part also closes the renderer
half of #227's recorded follow-up. Its preview half stays with #227, because
the preview has one fixed spelling relative to the source root.

## Design

### Path rule

Every config-relative field names the path that it reaches from the
configuration directory after `.`, `..`, and empty segments are removed. The
rule is lexical, as Node.js `path.resolve` is. A symbolic link before `..`
does not change the path: `link/../renderer.tsx` names `renderer.tsx`, not
the parent of the link target. The rule holds in the working tree and in the
base tree of a comparison. Validation messages keep the authored spelling,
because they name the setting as the author wrote it. Every later message
names the normalized repository-relative path.

### Resolver

`ResolvedConfig::repository_path(&self, value: &str) -> Option<String>` joins
a config-relative value to the configuration directory, removes the segments
with the shared `mokly_catalogue::config::normalize`, and returns the
repository-relative POSIX path. The configuration directory itself is the
empty string, as in `package_roots()`. The method returns `None` when the
path leaves `repo_root`. Loading rejects such a configured value, and
declaration validation rejects such a declared stylesheet. So a consumer that
gets `None` skips the value or keeps its existing path error.
`ResolvedConfig::renderer()` and `ResolvedConfig::postcss()` apply the
resolver to those two fields. `package_roots()` uses it too.

The methods derive the path from the authored input on each call, as
`package_roots()` does. Rejected: resolved copies in `ResolvedConfig` fields.
A hand-built or base fallback configuration, such as the one in
`crates/mokly-cli/src/changes_base.rs`, could keep a stale copy. `2261fa43`
gave the same reason.

### Consumers

| Field                     | Consumer                                                                                     | On `main`                | Change                 |
| ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ | ---------------------- |
| `repoRoot`, `roots[].dir` | Loader in `config.rs`. Later stages read `repo_root` and `ResolvedRoot`.                     | normalized               | none                   |
| `renderer`, `postcss`     | Presence checks in `prepare_definitions.rs`, `definitions.rs`, `graph.rs`, `changes_base.rs` | no path use              | none                   |
| `renderer`                | Validation in `config_paths.rs`                                                              | normalized               | none                   |
| `renderer`                | Bundle and describe requests and CSS Modules class maps: `bundle_inputs.rs`, `bundle.rs`     | authored spelling        | `renderer()`, item 167 |
| `renderer`                | Stylesheet roots and renderer exclusion in `mokly-render/src/graph.rs`                       | authored spelling        | `renderer()`, item 167 |
| `renderer`                | Renderer stylesheet link in `mokly-graph/src/styles.rs`                                      | private normalizer       | `renderer()`           |
| `postcss`                 | Validation in `config_postcss.rs`                                                            | private join, normalized | `local_path()`         |
| `postcss`                 | `processCss` requests and their messages: `stylesheets.rs`, `postcss.rs`                     | authored spelling        | `postcss()`, item 170  |
| Local stylesheets         | Validation in `config_paths.rs`                                                              | normalized               | none                   |
| Local stylesheets         | Stylesheet roots and links in `mokly-graph/src/styles.rs`                                    | private normalizer       | resolver               |
| Local stylesheets         | Configured set for the declared overlap in `declarations.rs`                                 | authored spelling        | resolver, item 169     |
| Declared stylesheets      | Declaration check in `declarations.rs`, roots and links in `styles.rs`                       | dot segments rejected    | resolver               |
| Package roots             | Sidecar settings, base dependencies, file policy, output boundary: `package_roots()`         | normalized               | resolver inside        |
| Package roots             | Manifest rule, file policy, output boundary: `package_root_aliases()`                        | authored spelling        | removed, item 171 B    |

`roots[].files` and `watch.rules[].paths` are globs relative to a root or to
the repository, not config-relative paths. `--out` is a command option that
resolves from the configuration directory with a private normalizer, which
Milestone 4 replaces.

### Tests

Repository-relative strings are the POSIX contract, so tests compare them as
strings. Tests compare joined filesystem paths as `Path` values, which is the
convention of item 172 A. Each regression test fails on `main` before its fix.

Contract owners:

- [Mokly Configuration Contract](../docs/protocol/mokly-configuration.md#shape):
  the path rule.
- [Imported Stylesheet Diagnostics](../docs/protocol/mokly-imported-styles-errors.md#configuration-config-invalid):
  the PostCSS path placeholders.
- [Renderer Stylesheets](../docs/protocol/mokly-rendering.md#renderer-stylesheets)
  and [Component Stylesheets](../docs/protocol/mokly-component-stylesheets.md):
  unchanged requirements that the bugs break.
- The [mokly-catalogue README](../crates/mokly-catalogue/README.md), the
  [mokly-render README](../crates/mokly-render/README.md), and the
  [mokly-graph README](../crates/mokly-graph/README.md).

## Milestone 1: Documentation and protocol

The configuration page states one path rule for every config-relative field.
The diagnostics catalogue defines its PostCSS path placeholders. No code
changes.

- [x] In `docs/protocol/mokly-configuration.md`, Shape, state the path rule
      above for every filesystem field, with the decision in force: `..` is
      removed lexically, not after a symbolic link is followed, so each field
      has one meaning on both comparison sides and in the sidecar.
- [x] Remove the package-root sentence from Module Resolution, because the
      rule covers it. Under 171 A, keep it and add the alias exception.
- [x] Add the line
      `Status: In progress under the [Normalize Config-Relative Paths](../../plans/normalize-config-relative-paths.md) plan.`
      below the title of the configuration page.
- [x] In `docs/protocol/mokly-imported-styles-errors.md`, define
      `{config-path}` as the `postcss` value as the configuration spells it.
      Write `{module}`, the repository-relative path, in the load and plugin
      factory rows. The code already prints these forms.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: One config-relative path resolver

`mokly-catalogue` gains the public resolver. The catalogue's own path code
reads it. The behaviour does not change.

- [x] Add `repository_path()`, `renderer()`, and `postcss()` to
      `ResolvedConfig` in `crates/mokly-catalogue/src/config_paths.rs`.
- [x] Derive `package_roots()` from `repository_path()`. Replace the private
      join in `config_postcss::validate` with `local_path()`.
- [x] Add unit tests for `../x` from a nested configuration, `a/../x`,
      `a/./x`, `a//x`, `./x`, `x/`, `.`, a path outside `repo_root`, and both
      accessors.
- [x] Describe the resolver in the mokly-catalogue README and its Key Code
      line for `config_paths.rs`.
- [x] Run `cargo test -p mokly-catalogue`, Clippy, `cargo fmt --all -- --check`,
      and `cargo xtask rust-file-length-lint`. `config_paths.rs` has 226 lines
      now.

## Milestone 3: Every consumer reads the resolver

The render and graph consumers read the resolver. This fixes 167, 169, and
170 on both comparison sides. Each regression test runs on the unfixed code
first, and its failure is saved under `.context/normalize-config-relative-paths/`.

Stylesheet and PostCSS part, after #228:

- [ ] 169: add a regression test. A configured `sub/../first.css` and a
      component that declares `first.css` prepare, and the document links
      `styles/first.css` once. Then `declarations.rs` reads the resolver.
- [ ] 170: add a regression test. With `"postcss": "tools/../postcss.mjs"`,
      every `processCss` request names `postcss.mjs`. Then `PostCss.module`
      becomes the repository-relative path from `ResolvedConfig::postcss()`.
- [ ] Replace the private `logical()` of `crates/mokly-graph/src/styles.rs`
      with the resolver.
- [ ] State the normalized repository-relative form in the doc comments of
      `ProcessCss.postcss` and the `PostcssFailure` module fields.
      `Load.module` says "Configuration-relative" now. Regenerate the
      TypeScript types with `cargo xtask generate-types`.
- [ ] Update the mokly-render and mokly-graph READMEs.
- [ ] Rerun the probes of 169 and 170 on the fixed build, and run the mockup
      check of `AGENTS.md`.
- [ ] Tick item 172 in `plans/rust-rebuild.md` with decision 172 A.
- [ ] Run the tests of the touched crates and the new tests.

Renderer part, after #227 merges:

- [ ] 167: add the regression tests.
  - [ ] An integration test with a configuration in `app/`,
        `repoRoot: ".."`, and `"renderer": "../renderer.tsx"`. The generation
        has `styles/renderer.tsx.css`, the screen links it, and the `bundle`
        request names `renderer.tsx`.
  - [ ] Unit tests of `bundle_inputs::params` for `app/../renderer.tsx`,
        `lib/./renderer.tsx`, and `lib//renderer.tsx`.
  - [ ] A render-key test with the nested configuration: the graph names
        `renderer.tsx`, `unnamed_renderer` is false, and a renderer edit
        moves the entry keys instead of the whole-bundle fallback.
  - [ ] A CLI comparison test with the nested configuration. A branch edit
        of the renderer's CSS gives `Changes ready · 1 change`.
- [ ] `bundle_inputs.rs` and `mokly-render/src/graph.rs` read
      `ResolvedConfig::renderer()`. State the normalized form in the doc
      comment of `Bundle.renderer`, and regenerate the TypeScript types.
- [ ] Update the mokly-render README.
- [ ] Rerun every probe on the fixed build. Run the mockup check of
      `AGENTS.md`, and smoke-test the example through `npm run dev`.
- [ ] Run the tests of the touched crates and the new tests.

## Milestone 4: One lexical normalizer

The two private copies of the lexical normalizer go. The behaviour does not
change.

- [ ] Replace the private `normalize` of
      `crates/mokly-render/src/postcss_inventory.rs`, which three PostCSS
      modules use, and of `crates/mokly-static/src/location.rs` with
      `mokly_catalogue::config::normalize`.
- [ ] Run `cargo test -p mokly-render -p mokly-static`.

## Milestone 5: One lexical rule for package roots

This milestone needs decision 171 B. It closes 171 and 168. Under 171 A or C,
replace it with that option.

- [ ] Add the regression tests first:
  - [ ] `link/../ui`, where only the link target holds `package.json`, fails
        with `moduleResolution.packageRoots[0]: link/../ui must contain package.json`.
  - [ ] `file.txt/../ui` with `ui/package.json` builds. On `main` the output
        boundary fails with `resolve failed ... Not a directory`.
- [ ] Remove `ResolvedConfig::package_root_aliases()`. `has_manifest` reads
      only the normalized root. `FilePolicy::new` and `Boundary::catalogue`
      stop reading the aliases.
- [ ] Change the tests that pin the aliases, and record decision 171 B as the
      approval in the commit message:
  - [ ] Delete `package_root_aliases_keep_only_parent_segment_spellings` and
        `a_parent_segment_spelling_keeps_its_physical_target_private`.
  - [ ] Expect the rejection in
        `the_authored_spelling_target_still_satisfies_the_manifest_rule` and
        `a_package_root_spelled_through_a_link_keeps_its_acceptance_and_normalizes`.
  - [ ] Expect only normalized manifests in
        `package_manifests_use_normalized_roots_and_parent_spellings`.
- [ ] Remove the alias text from the mokly-catalogue and mokly-graph READMEs.
- [ ] Tick items 168 and 171 in `plans/rust-rebuild.md`.
- [ ] Run `cargo test -p mokly-catalogue -p mokly-graph -p mokly-static`.

## Milestone 6: Verification, commit, review, and pull request

- [ ] Remove the status line of the configuration page when every rule of
      Milestone 1 is implemented.
- [ ] After #227 merges, tick items 167, 169, 170, and 182 in
      `plans/rust-rebuild.md`, with the user decisions, their dates, and a
      link to this plan.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
