# Normalize Config-Relative Paths

Status: Active. On branch
`conductor/rust-rebuild-167-normalize-config-relative-paths`, no pull request
yet. The plan closes when its PR merges. Every decision below waits for the
user, so no implementation milestone has started.

This plan resolves user item 167 of the
[Rust rebuild plan](./rust-rebuild.md#open-user-items-deferred-by-the-user-on-2026-10-21),
and items 169 and 170, which the recommended option 167 B also fixes. It
proposes to resolve items 168 and 171 here too, because they decide the same
path rule for package roots. The rebuild review W8 recorded items 167 to 174
on 2026-10-22.

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

Not covered: item 182, duplicate package roots on the head side; item 174,
symbolic links in the base Git tree; and the decision of item 172, path
comparison in Rust tests. The decisions say why. The tests of this plan
follow the convention of 172 A.

## Decisions

All decisions are open on 2026-10-27. The milestones follow the recommended
options. A different answer changes the milestones that the decision names.

- 167, renderer stylesheet lost (Medium). A: normalize the renderer path at
  the two render call sites, Small. B: one public `ResolvedConfig` resolver
  for every config-relative path, read by every consumer, with the path rule
  in the configuration page, Large. Recommended: B. One resolver also fixes
  169 and 170, and the next consumer has no reason to join the authored
  spelling. `2261fa43` gave package roots the same fix after a High security
  finding.
- 169, configured stylesheet overlap (Low). A: normalize the configured list
  in `declarations.rs`, Small. B: the resolver of 167 B, Large. Recommended:
  B.
- 170, PostCSS module spelling in messages (Low). A: normalize before the
  sidecar call, Small. B: the resolver of 167 B, Large. Recommended: B.
- 168, the manifest rule accepts two rare roots (Low). A to D as recorded. E,
  new: close it with 171 B. Recommended: E. Under the lexical rule both roots
  are valid, and without the aliases the output boundary no longer projects
  `file.txt/../ui/package.json`. Under 171 A, the recommendation is A.
- 171, a symbolic link before `..` in a package root (Low). A: keep the
  aliases and state the exception. B: use only the normalized root and
  remove the aliases, Large. C: reject such a spelling with a new message.
  Recommended: B. The loader, the graph crate, and the sidecar already read
  the renderer, the PostCSS module, and stylesheets lexically, so B gives
  every field one rule.
  B removes behaviour that is on `main`, so it needs the user's approval.
  Milestone 5 depends on it.
- 182, duplicate package roots on the head side (Low). Recommended: C, new:
  one function builds the ancestor and package-root list for both sides, in
  its own change. The recorded B does not fix the recorded example, because
  the duplicate comes from the ancestor list, not from `package_roots()`.
- 174, symbolic links in the base Git tree (Low). Recommended: keep it out of
  this plan and write its options in its own change. After 171 B, a link
  before `..` no longer reaches the Git tree.
- 172, path comparison in Rust tests (Low). Recommended: A. The tests of this
  plan follow it. Under A, Milestone 3 also ticks 172.

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

- [ ] In `docs/protocol/mokly-configuration.md`, Shape, state the path rule
      above for every filesystem field, with the decision in force: `..` is
      removed lexically, not after a symbolic link is followed, so each field
      has one meaning on both comparison sides and in the sidecar.
- [ ] Remove the package-root sentence from Module Resolution, because the
      rule covers it. Under 171 A, keep it and add the alias exception.
- [ ] Add the line
      `Status: In progress under the [Normalize Config-Relative Paths](../../plans/normalize-config-relative-paths.md) plan.`
      below the title of the configuration page.
- [ ] In `docs/protocol/mokly-imported-styles-errors.md`, define
      `{config-path}` as the `postcss` value as the configuration spells it.
      Write `{module}`, the repository-relative path, in the load and plugin
      factory rows. The code already prints these forms.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: One config-relative path resolver

`mokly-catalogue` gains the public resolver. The catalogue's own path code
reads it. The behaviour does not change.

- [ ] Add `repository_path()`, `renderer()`, and `postcss()` to
      `ResolvedConfig` in `crates/mokly-catalogue/src/config_paths.rs`.
- [ ] Derive `package_roots()` from `repository_path()`. Replace the private
      join in `config_postcss::validate` with `local_path()`.
- [ ] Add unit tests for `../x` from a nested configuration, `a/../x`,
      `a/./x`, `a//x`, `./x`, `x/`, `.`, a path outside `repo_root`, and both
      accessors.
- [ ] Describe the resolver in the mokly-catalogue README and its Key Code
      line for `config_paths.rs`.
- [ ] Run `cargo test -p mokly-catalogue`, Clippy, `cargo fmt --all -- --check`,
      and `cargo xtask rust-file-length-lint`. `config_paths.rs` has 226 lines
      now.

## Milestone 3: Every consumer reads the resolver

The render and graph consumers read the resolver. This fixes 167, 169, and
170 on both comparison sides.

- [ ] Add the regression tests first. Run them on the unfixed code and save
      the failures under `.context/normalize-config-relative-paths/`.
  - [ ] 167: a new `crates/mokly-render/tests/integration/config_path_tests.rs`
        with a configuration in `app/`, `repoRoot: ".."`, and
        `"renderer": "../renderer.tsx"`. The generation has
        `styles/renderer.tsx.css`, the screen links it, and the captured
        `bundle` request names `renderer.tsx`.
  - [ ] 167: unit tests of `bundle_inputs::params` for
        `app/../renderer.tsx`, `lib/./renderer.tsx`, and `lib//renderer.tsx`.
  - [ ] 167: a CLI comparison test with the nested configuration. A branch
        edit of the renderer's CSS gives `Changes ready · 1 change`.
  - [ ] 169: a configured `sub/../first.css` and a component that declares
        `first.css` prepare, and the document links `styles/first.css` once.
  - [ ] 170: with `"postcss": "tools/../postcss.mjs"`, every captured
        `processCss` request names `postcss.mjs`. The disconnect message and
        the timeout label read this request field.
- [ ] Read the resolver in `bundle_inputs.rs`, `mokly-render/src/graph.rs`,
      `declarations.rs`, `stylesheets.rs`, and `postcss.rs`. `PostCss.module`
      becomes the repository-relative path.
- [ ] Replace the private `logical()` of `crates/mokly-graph/src/styles.rs`
      with the resolver.
- [ ] State the normalized repository-relative form in the doc comments of
      `Bundle.renderer`, `ProcessCss.postcss`, and `PostcssFailure` module
      fields. `Load.module` says "Configuration-relative" now. Regenerate the
      TypeScript types with `cargo xtask generate-types`.
- [ ] Update the mokly-render and mokly-graph READMEs.
- [ ] Rerun the probes under `.context/normalize-config-relative-paths/probes`
      on the fixed build and save the logs.
- [ ] Run the mockup check of `AGENTS.md` and smoke-test the example through
      `npm run dev`.
- [ ] Tick items 167, 169, and 170 in `plans/rust-rebuild.md`, with the user
      decisions, their dates, and a link to this plan. Under 172 A, tick 172.
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
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
