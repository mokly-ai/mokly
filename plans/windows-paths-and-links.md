# Windows Paths And Base-Tree Links

Status: Active. On branch
`conductor/rust-rebuild-166-windows-paths-and-links`, no pull request yet.
The plan closes when its PR merges. Every decision below waits for the user,
so no implementation milestone has started.

This plan resolves user items 166, 179, 174, and 173 of the
[Rust rebuild plan](./rust-rebuild.md#open-user-items-deferred-by-the-user-on-2026-10-21).
Native CI round 6 recorded 166, the rebuild review W8 recorded 173 and 174,
and the delta review recorded 179.

Mokly Changes compares the working tree with a base commit. The head side
reads the working tree through `WorkingTree`. The base side reads the base
commit through `GitTree`, a `SourceTree` adapter over one Git index, and
extracts JavaScript sources into a cache outside the repository. Two items
concern the Windows spelling of canonical paths. `std::fs::canonicalize`
returns the verbatim `\\?\C:\` form on Windows, and npm and Node do not treat
that form and the plain `C:\` form as one root. `dunce::canonicalize` returns
the plain form when that form can name the location, and the verbatim form
for a path over 260 characters or with a reserved name. The other two items
concern symbolic links in the base Git tree and Git isolation in a test.

- 166: product code still calls `std::fs::canonicalize` in
  `crates/mokly-git/src/disk.rs` and
  `crates/mokly-sidecar/src/memory_table.rs`. Neither result reaches Node
  today, so this is hygiene, not a visible bug.
- 179: the "cache inside the repository" check in
  `crates/mokly-compare/src/locations.rs` compares two `dunce` results with
  `Path::starts_with`. The standard library compares path prefixes by kind,
  so a verbatim cache path never starts with a plain repository path. The
  check misses only when `LOCALAPPDATA` points into the repository through a
  path over 260 characters or with a reserved name.
- 174: `GitTree` reports a Git link entry as `Symlink` and never resolves
  it, and Git itself neither lists nor reads a path through a link. A root or
  package root that is a link, or lies below one, loads in the working tree
  and fails in the base tree with `config-invalid`.
- 173: `crates/mokly-compare/tests/large_sources_tests.rs` runs Git with its
  own helper, without the `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_NOSYSTEM`
  isolation of `support::git`, so a global `commit.gpgsign = true` fails it.

The probes on `main` are under `.context/windows-paths-and-links/`:
`item-173-probe-main-d4c6f6a8.log`, `item-174-probe-main-d4c6f6a8.log` with
its source `item-174-probe_tests.rs.txt`, `item-174-git-link-probe.log`,
`std-and-dunce-facts.md`, and `windows-check-probe.log`. The files that this
plan changes are equal on `d4c6f6a8` and on `9ce75853`, the `main` head when
the plan was written.

Not covered: the package-root path rule of item 171 B and the removal of
`ResolvedConfig::package_root_aliases()`, which the
`normalize-config-relative-paths` plan of workspace 386 owns on its branch
`conductor/rust-rebuild-167-normalize-config-relative-paths`, not merged
yet; the seven other Rust test helpers that commit without Git isolation,
and the shared helper of workspace 353, which the decisions list as
follow-ups; and the convention of item 172 A, which the tests of this
plan follow.

## Decisions

All decisions are open on 2026-10-28. The milestones follow the recommended
options. A different answer changes the milestones that the decision names.

- 166, `std::fs::canonicalize` in product code (Low). A: keep the two calls.
  B: use `dunce::canonicalize` in both, forbid `std::fs::canonicalize` and
  `Path::canonicalize` with a Clippy `disallowed-methods` rule in a new
  `clippy.toml`, and convert the 36 test call sites in 19 files that the rule
  then flags, because Clippy runs with `--all-targets`, Large. C: B without
  the rule and without the test conversions, Medium. Recommended: B, as
  recorded. B adds a new lint, so it needs the user's approval. Milestone 3
  depends on it.
- 179, the cache location check compares two path forms (Low, product bug).
  A: compare both paths in one form, the plain form with the verbatim prefix
  removed, and keep the returned path as it is, Small. B: document the limit
  on the base cache page, Small. Recommended: A, as recorded. Milestone 4
  depends on it.
- 174, a root or package root that is a link fails in the base tree (Low,
  product bug). A: resolve links in `GitTree` as the working tree does, with
  the extraction unchanged, so HTML, Markdown, YAML, and CSS sources below a
  linked root compare and a JavaScript source below a linked root keeps a
  base failure that names the link, Large. B: A, and write a directory link
  of the base commit into the extraction as a filesystem link, so JavaScript
  below a linked root bundles too, Large, with a new Windows dependency for
  junctions or a privilege requirement. C: keep the failure and name the link
  in the message, Small. Recommended: A. The root discovery page says that
  the same roots and diagnostics apply to both trees, the working tree
  accepts a linked root today, and the reader already fetches link blobs; B
  pays for a case with no known user, and C keeps the parity gap. A adds a
  requirement to the root discovery page, so it needs the user's answer.
  Milestone 5 depends on it.
- 173, a test runs Git without isolation (Low, test). A: use the isolated
  `support::git`, with a variant that pipes standard input, Small. B: A, and
  a check that rejects `Command::new("git")` in Rust tests outside the
  support modules, a new gate. C: A, and the same isolation in the seven
  other helpers that commit without it: `crates/mokly-cli/tests` in
  `design_support/mod.rs`, `html_dependencies/large.rs`,
  `html_dependencies_tests.rs`, `publish_tests.rs`, and
  `serve_js/html_dependency_tests.rs`, and `crates/mokly-publish/tests` in
  `checkout_status_tests.rs` and `support/checkout.rs`, Small. Recommended:
  A, as recorded. Workspace 353 adds the shared `mokly-test-support::git`
  helper, which runs Git without isolation too. One isolated shared helper is
  the structural fix for the whole class, so the follow-up waits for that
  crate. Milestone 2 depends on it.

## Design

### Plain canonical paths

`Disk::canonicalize` in `mokly-git` resolves the configured repository
directory and Git's checkout root, and `Repositories::open` compares the two.
`ProcessTable::canonicalize` in `mokly-sidecar` resolves the executable of
each owned process, so a Node binary started through a symlink matches its
children. Both compare one canonical form with another from the same
function, so the switch to `dunce::canonicalize` changes no comparison. It
changes only the spelling that the root error message shows on Windows.
`mokly-git` gains the `dunce` dependency that six other crates already use.

The Clippy rule lives in a new workspace `clippy.toml`:

```toml
disallowed-methods = [
  { path = "std::fs::canonicalize", reason = "returns the Windows verbatim form that npm and Node reject; use dunce::canonicalize" },
  { path = "std::path::Path::canonicalize", reason = "returns the Windows verbatim form that npm and Node reject; use dunce::canonicalize" },
]
```

The rule covers tests, because the gate runs Clippy with `--all-targets`.
The 36 test call sites move to `dunce::canonicalize`. `mokly-graph` and
`xtask` gain `dunce` as a development dependency. Workspace 353 keeps six of
those sites in files it touches and adds one `fs::canonicalize` call in
`crates/mokly-cli/tests/sidecar_rendering/wrapper.rs`; whichever branch
merges second converts them.

### One path form in the cache location check

`SystemLocations::repository` keeps its two `dunce::canonicalize` calls and
its returned path. A new pure function `inside_repository(directory,
repository)` compares both paths after one `plain` conversion: a
`VerbatimDisk` prefix becomes the `Disk` prefix, a `VerbatimUNC` prefix
becomes the `UNC` prefix, and every other path stays as it is. On other
platforms `plain` is the identity. The Windows tests build the verbatim and
plain spellings as literals and run in the hosted Windows job. The behaviour
at the boundary stays the one that the base cache page states: a cache
location inside the repository is invalid.

### Links in the base Git tree

Rule shared with item 171 B: normalization is lexical and comes first. A
config-relative path names the path that it reaches after `.`, `..`, and
empty segments are removed. Projection comes second: the source tree resolves
the symbolic links of that normalized path to the identity, in both trees.
Discovery below a root never follows a link, and a public file is denied at
every link component, in both trees. Those two rules are unchanged.

`GitTree` gains a resolver in a new module `git_links.rs`. It turns a lexical
path below the root into the physical repository path and the lexical kind of
the final component:

1. Strip the root. The relative path must consist of plain components, as
   today.
2. Walk the prefixes. A prefix comes from the index when an expanded root
   covers it. Otherwise one `ensure` call carries every uncovered prefix of
   the path, so a path below an expanded root makes no Git query. A missing
   prefix projects to `None`. A `Directory` prefix continues.
3. A `Symlink` prefix reads its target through the new
   `Sources::link_target`, joins the target to the link's parent lexically,
   and continues from the result. An absolute target, or a target that
   leaves the repository, projects to a node whose identity lies outside the
   root and whose kind is `Other`, so the loader's existing `outside repoRoot`
   and `must be a directory` rules apply. The walk resolves at most 40
   links, as Unix does, and then fails with `ErrorKind::FilesystemLoop`,
   which `SourceError::code` reports as `ELOOP`.
4. `project` reports the lexical kind of the final component, the kind of
   the resolved entry, and the identity as the root joined with the physical
   path in host separators. `children`, `read`, `digest`, `open_stream`, and
   `prefetch` resolve the intermediate links and treat a final link as they
   do today: not a directory, not a regular file.

`Sources::link_target(path)` returns the target text of one link entry.
`GitSources` reads it through the new `Repository::link_target(commit,
entry)` in `mokly-git`, a raw `cat-file blob` read bounded at 4 KiB. The
probe shows that `cat-file --batch --filters` rejects a link, while the raw
read returns the target. A non-link entry fails with a typed error.

The consumers keep their behaviour. Discovery lists children through the
root identity and projects each matched file by its lexical path. The
catalogue loader checks `node.kind` and `node.identity` for roots and
package roots. The public closure, the Markdown assets, and the CSS asset
check deny a `Symlink` lexical kind at every component.

The extraction keeps regular files only, so a JavaScript, stories, renderer,
or PostCSS source whose base path goes through a link has no file in the
extraction. Option A keeps that limit and gives it a clear failure: the base
side fails with a message that names the link and the source. The milestone
probes the failure after the projection fix and adds the check in
`crates/mokly-cli/src/changes_base.rs` when the existing failure does not
name the link.

### Isolated Git in tests

`support::git` of `crates/mokly-compare/tests` gains `git_input(root, args,
input)`, which pipes `input` to Git with the same `GIT_CONFIG_GLOBAL` and
`GIT_CONFIG_NOSYSTEM` isolation, and `git` delegates to it with empty input.
`large_sources_tests.rs` drops its own helper and reads the support module.

### Tests

Tests compare joined filesystem paths as `Path` values, the convention of
item 172 A. Repository-relative strings are the POSIX contract and compare as
strings. Each regression test fails on `main` before its fix. Git tree tests
create link entries with `git update-index --cacheinfo 120000`, which needs
no filesystem link, so they run on Windows too. A comparison test that needs
a link in the working tree is Unix-only, as the existing alias tests are.

Contract owners:

- [Root discovery](../docs/protocol/mokly-root-discovery.md): links at a
  root or package root in both trees.
- [Base preparation cache](../docs/protocol/mokly-base-cache.md): the cache
  location rule, unchanged.
- [Git command runtime](../docs/protocol/mokly-git.md): the canonical root
  comparison, unchanged.
- The [mokly-git README](../crates/mokly-git/README.md), the
  [mokly-compare README](../crates/mokly-compare/README.md), the
  [mokly-sidecar README](../crates/mokly-sidecar/README.md), and the
  [mokly-source-interface README](../crates/mokly-source-interface/README.md).
- [AGENTS.md](../AGENTS.md) and the
  [development guide](../docs/development/README.md): the Clippy rule.

## Milestone 1: Documentation and protocol

The root discovery page states the link rule for roots and package roots.
The other pages keep their requirements. No code changes.

- [ ] In `docs/protocol/mokly-root-discovery.md`, after the sentence on
      link entries in a Git tree, state: a root or package root that is a
      symbolic link, or lies below one, resolves to its target in both
      trees, and the target must lie inside `repoRoot`; the base extraction
      holds regular files only, so a JavaScript, stories, renderer, or
      PostCSS source below such a link fails the base side with a message
      that names the link. Under 174 C, state instead that the base tree
      does not resolve links and names the link in its failure.
- [ ] Add the line
      `Status: In progress under the [Windows Paths And Base-Tree Links](../../plans/windows-paths-and-links.md) plan.`
      below the title of the root discovery page.
- [ ] Under 166 B, add one bullet to the repository rules of `AGENTS.md`
      and one sentence to `docs/development/README.md`: `clippy.toml`
      forbids `std::fs::canonicalize` and `Path::canonicalize`; use
      `dunce::canonicalize`.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Isolated Git in the large-sources tests

This milestone needs decision 173 A. It changes tests only.

- [ ] Add `git_input` to `crates/mokly-compare/tests/support/mod.rs` and
      make `git` delegate to it.
- [ ] Replace the private helper of `large_sources_tests.rs` with the
      support module.
- [ ] Rerun the probe with a global `commit.gpgsign = true` and
      `gpg.program = false` through `GIT_CONFIG_GLOBAL`, and save the passing
      log as `.context/windows-paths-and-links/item-173-after.log`.
- [ ] Run `cargo test -p mokly-compare --test large_sources_tests`.

## Milestone 3: Plain canonical paths and the Clippy rule

This milestone needs decision 166 B. Under 166 C, do the first two TODOs
only. Under 166 A, skip it.

- [ ] Add `dunce` to `crates/mokly-git/Cargo.toml` and switch
      `SystemDisk::canonicalize` and `SystemTable::canonicalize` to
      `dunce::canonicalize`.
- [ ] Update the mokly-git README sentence on canonical identities and the
      Key Code line of `disk.rs`.
- [ ] Add `clippy.toml` with the `disallowed-methods` rule above.
- [ ] Convert the 36 test call sites in `crates/mokly-cli/tests`,
      `crates/mokly-compare/tests`, `crates/mokly-graph/tests`,
      `crates/mokly-sidecar/tests`, and `xtask/src/remote/snapshot/_tests_`
      to `dunce::canonicalize`. Add `dunce` as a development dependency of
      `mokly-graph` and `xtask`.
- [ ] Run `cargo clippy --workspace --all-targets -- -D warnings`,
      `cargo check --target x86_64-pc-windows-msvc -p mokly-git -p mokly-sidecar`,
      and `cargo test -p mokly-git -p mokly-sidecar`.

## Milestone 4: One path form in the cache location check

This milestone needs decision 179 A. Under 179 B, replace it with one
sentence on the base cache page.

- [ ] Add the regression tests first in
      `crates/mokly-compare/src/_tests_/locations_tests.rs`: on Windows, a
      verbatim cache path below a plain repository path and a verbatim UNC
      path below a plain UNC path are inside; on every platform, a plain path
      below another is inside, and a sibling is not.
- [ ] Add `plain` and `inside_repository` to `locations.rs` and use them in
      `SystemLocations::repository`.
- [ ] Run `cargo test -p mokly-compare locations`,
      `cargo check --target x86_64-pc-windows-msvc -p mokly-compare`, and
      Clippy. The hosted Windows job runs the Windows tests.

## Milestone 5: Links in the base Git tree

This milestone needs decision 174 A. Under 174 C, replace it with a
loader message in `crates/mokly-catalogue/src/config.rs` and
`config_paths.rs` for a node whose kind is `Symlink`, and its test. Under
174 B, add the extraction link writes after the projection TODOs.

- [ ] Add the regression tests first and save their failures on `main`
      under `.context/windows-paths-and-links/`:
  - [ ] `crates/mokly-compare/tests/linked_roots_tests.rs`, from the probe
        source: a package root that is a link, a package root below a link,
        and a root that is a link load through `GitSourceFactory` and
        discover the same files as the working tree; a link whose target
        leaves the repository fails with `outside repoRoot`; a link loop
        fails with `ELOOP`.
  - [ ] Unit tests of the resolver in
        `crates/mokly-compare/src/_tests_/git_links_tests.rs` with
        `SourcesMock`: prefix lookups use the index below an expanded root,
        one `ensure` call per uncovered path, the hop bound, and the lexical
        kind of a final link.
  - [ ] A `mokly-git` test of `link_target`: the target text of a link
        entry, the byte bound, and the typed error for a regular entry.
  - [ ] A Unix-only `mokly-cli` comparison test with a linked spec root and
        a linked package root on both sides, which reports the edited entry.
- [ ] Add `Repository::link_target` to `crates/mokly-git/src/repository.rs`
      with its implementation in a new small module, and the `NotLink`
      error variant.
- [ ] Add `Sources::link_target` to `crates/mokly-compare/src/sources.rs`.
- [ ] Add `git_links.rs` with the resolver, and route `project`,
      `children`, `read`, `digest_file`, `opaque_stream`, and
      `prefetch_sources` through it. Keep `git_tree.rs` under 300 lines.
- [ ] Map `ErrorKind::FilesystemLoop` to `ELOOP` in
      `SourceError::code` of `mokly-source-interface`.
- [ ] Probe the base render of a JavaScript entry below a linked root. When
      the failure does not name the link, add the check in
      `crates/mokly-cli/src/changes_base.rs` with the message of Milestone 1,
      and test it.
- [ ] Update the READMEs of mokly-git, mokly-compare, and
      mokly-source-interface: the Key Code lines for the new modules, and
      the sentence that a Git adapter resolves directory links at projected
      paths and never reads a link blob as a source file.
- [ ] Remove the status line of the root discovery page.
- [ ] Run `cargo test -p mokly-git -p mokly-compare -p mokly-source-interface -p mokly-cli`,
      `cargo xtask rust-file-length-lint`, and Clippy.

## Milestone 6: Verification, commit, review, and pull request

- [ ] Tick items 166, 173, 174, and 179 in `plans/rust-rebuild.md` with the
      user decisions, their dates, and a link to this plan, with the smallest
      edit.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Open the pull request when every other milestone TODO is ticked.
      Put its link in the status paragraph.
