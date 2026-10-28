# Windows Paths And Base-Tree Links

Status: Active. On branch
`conductor/rust-rebuild-166-windows-paths-and-links`, no pull request yet.
The plan closes when its PR merges. The coordinator answered every decision
on 2026-10-28. The Clippy rule of item 166 B waits for the user and is not
part of this change.

This plan resolves user items 179, 174, and 173 of the
[Rust rebuild plan](./rust-rebuild.md#open-user-items-deferred-by-the-user-on-2026-10-21),
and the product part of item 166. Native CI round 6 recorded 166, the
rebuild review W8 recorded 173 and 174, and the delta review recorded 179.

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
  today. The only visible effect is the Windows spelling in the Git root
  mismatch error.
- 179: the "cache inside the repository" check in
  `crates/mokly-compare/src/locations.rs` compares two `dunce` results with
  `Path::starts_with`. The standard library compares path prefixes by kind,
  so a verbatim cache path never starts with a plain repository path. The
  check misses only when `LOCALAPPDATA` points into the repository through a
  path over 260 characters or with a reserved name.
- 174: `GitTree` reports a Git link entry as `Symlink` and never resolves
  it, and Git itself neither lists nor reads a path through a link. A root or
  package root that is a link, or lies below one, loads in the working tree
  and fails in the base tree with `config-invalid`. The message does not
  name the link: it says "must be a directory" for a link and "does not
  exist" for a path below one.
- 173: `crates/mokly-compare/tests/large_sources_tests.rs` runs Git with its
  own helper, without the `GIT_CONFIG_GLOBAL` and `GIT_CONFIG_NOSYSTEM`
  isolation of `support::git`, so a global `commit.gpgsign = true` fails it.

The probes on `main` are under `.context/windows-paths-and-links/`:
`item-173-probe-main-d4c6f6a8.log`, `item-174-probe-main-d4c6f6a8.log` with
its source `item-174-probe_tests.rs.txt`, `item-174-git-link-probe.log`,
`std-and-dunce-facts.md`, and `windows-check-probe.log`.

Not covered: the package-root path rule of item 171 B and the removal of
`ResolvedConfig::package_root_aliases()`, which the
`normalize-config-relative-paths` plan of workspace 386 owns on its branch
`conductor/rust-rebuild-167-normalize-config-relative-paths`, not merged
yet; the Clippy rule of item 166 B; the seven other Rust test helpers that
commit without Git isolation, and the shared helper of workspace 353; and
the convention of item 172 A, which the tests of this plan follow.

## Decisions

The coordinator answered each decision on 2026-10-28, after an independent
reviewer checked the options. The recorded options were:

- 166, `std::fs::canonicalize` in product code (Low). A: keep the two calls.
  B: use `dunce::canonicalize` in both, forbid `std::fs::canonicalize` and
  `Path::canonicalize` with a Clippy `disallowed-methods` rule in a new
  `clippy.toml`, and convert the 36 test call sites in 19 files that the rule
  then flags, Large. C: B without the rule and without the test conversions,
  Medium.
- 179, the cache location check compares two path forms (Low, product bug).
  A: compare both paths in one form and keep the returned path, Small. B:
  document the limit on the base cache page, Small.
- 174, a root or package root that is a link fails in the base tree (Low,
  product bug). A: resolve links in `GitTree` as the working tree does,
  Large. B: A, and write directory links into the extraction, Large. C: keep
  the failure and name the link in the message, Small.
- 173, a test runs Git without isolation (Low, test). A: use the isolated
  `support::git`, with a variant that pipes standard input, Small. B: A, and
  a check that rejects `Command::new("git")` in Rust tests outside the
  support modules, a new gate. C: A, and the same isolation in the seven
  other helpers that commit without it, Small.

The answers:

1. 166: the product part of B and C, now. `SystemDisk::canonicalize` and
   `SystemTable::canonicalize` use `dunce::canonicalize`, and `mokly-git`
   gains the `dunce` dependency that the workspace already uses. The
   `clippy.toml` rule and the test conversions of B are a new lint, so they
   wait for the user. Item 166 stays open for that part.
2. 179: A. The check compares both paths in one form, and
   `SystemLocations::repository` returns its path unchanged. Rejected: B,
   because the comparison fix is Small and keeps the rule of the base cache
   page.
3. 174: C. The base tree keeps the failure, and the loader message names the
   link. Rejected: A, because the item is Low with no known user, Git for
   Windows checks out links as plain files by default, and A is Large and
   partial, with no JavaScript below a linked root, in the base read path
   that PR #236 changed. Rejected: B, because it adds extraction links to A.
   A clearer message for an existing failure is not a new rejection, so it
   needs no approval. The rule shared with item 171 B holds: normalization is
   lexical and comes first, in both trees.
4. 173: A. `support::git` gains a variant that pipes standard input, and
   `large_sources_tests.rs` uses it. Rejected: B, because it is a new gate.
   Rejected: C, because one isolated helper in the shared test crate of
   workspace 353 is the structural fix for the other helpers.

## Design

### Plain canonical paths

`Disk::canonicalize` in `mokly-git` resolves the configured repository
directory and Git's checkout root, and `Repositories::open` compares the two.
`ProcessTable::canonicalize` in `mokly-sidecar` resolves the executable of
each owned process, so a Node binary started through a symlink matches its
children. Both compare one canonical form with another from the same
function, so the switch to `dunce::canonicalize` changes no comparison. It
changes only the spelling that the root error message shows on Windows.

The Clippy rule of 166 B waits for the user. When the user approves it, it
lives in a new workspace `clippy.toml`, and the 36 test call sites move to
`dunce::canonicalize`:

```toml
disallowed-methods = [
  { path = "std::fs::canonicalize", reason = "returns the Windows verbatim form that npm and Node reject; use dunce::canonicalize" },
  { path = "std::path::Path::canonicalize", reason = "returns the Windows verbatim form that npm and Node reject; use dunce::canonicalize" },
]
```

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

Rule shared with item 171 B: normalization is lexical and comes first, in
both trees. A config-relative path names the path that it reaches after `.`,
`..`, and empty segments are removed. Projection comes second. The working
tree resolves the symbolic links of the normalized path. The base Git tree
does not resolve links: it reports a link entry as `Symlink`, and a path
below a link projects to `None`. Discovery below a root never follows a
link, and a public file is denied at every link component, in both trees.
Those rules do not change.

The loader keeps the base failure and names the link. A new crate-private
helper in `crates/mokly-catalogue/src/config_links.rs` walks the normalized
path below `repo_root` one component at a time, from the top, and projects
each prefix. A `Directory` continues. The first prefix whose projection has
the kind `Symlink` is the link, and the helper returns its
repository-relative POSIX path. A missing prefix, a file, or a projection
error ends the walk with no link. The helper runs only after a check fails,
so a valid configuration makes no extra projection.

Three checks call the helper when they fail:

- the roots check in `config.rs`, for a missing root or a root that is not a
  directory;
- `confined` in `config_paths.rs`, for a missing path or a path of the wrong
  kind, which covers the renderer, local stylesheets, and package roots;
- the PostCSS check in `config_postcss.rs`, for a missing module or a module
  that is not a regular file.

When the helper finds a link, the message is:

```text
{setting}: {value} uses the symbolic link {link}; name the target path instead
```

`{setting}` and `{value}` are the setting and the authored spelling of the
existing message, for example `moduleResolution.packageRoots[0]` and
`../packages/ui`, `roots[0].dir`, or `postcss`. `{link}` is the
repository-relative path of the link, for example `packages/ui`. Without a
link, each check keeps its existing message. The working tree resolves every
link, so its projections never have the kind `Symlink`, and its messages do
not change. Changes shows the message below "Changes unavailable · base
validation failed".

### Isolated Git in tests

`support::git` of `crates/mokly-compare/tests` gains `git_input(root, args,
input)`, which pipes `input` to Git with the same `GIT_CONFIG_GLOBAL` and
`GIT_CONFIG_NOSYSTEM` isolation, and `git` delegates to it with empty input.
A scoped thread writes the input, so a large input and a large output cannot
block each other. `large_sources_tests.rs` drops its own helper and reads
the support module.

### Tests

Tests compare joined filesystem paths as `Path` values, the convention of
item 172 A. Repository-relative strings are the POSIX contract and compare as
strings. Each regression test fails on `main` before its fix where this host
can run it. The Windows tests of 166 and 179 compile here for
`x86_64-pc-windows-msvc` and run only in the hosted Windows job, so their
failure on `main` cannot be shown here. Git tree tests create link entries
with `git update-index --cacheinfo 120000`, which needs no filesystem link,
so they run on Windows too. A test that needs a link in the working tree is
Unix-only, as the existing alias tests are.

Contract owners:

- [Root discovery](../docs/protocol/mokly-root-discovery.md): a root or
  package root that is a link, or lies below one, in the base tree.
- [Base preparation cache](../docs/protocol/mokly-base-cache.md): the cache
  location rule, unchanged.
- [Git command runtime](../docs/protocol/mokly-git.md): the canonical root
  comparison, unchanged.
- The [mokly-git README](../crates/mokly-git/README.md), the
  [mokly-compare README](../crates/mokly-compare/README.md), and the
  [mokly-catalogue README](../crates/mokly-catalogue/README.md).

## Milestone 1: Documentation and protocol

The root discovery page states the base link rule for roots and package
roots. The other pages keep their requirements. No code changes.

- [x] In `docs/protocol/mokly-root-discovery.md`, after the sentence on
      link entries in a Git tree, state the rule of 174 C: the base Git tree
      does not resolve symbolic links, so after lexical normalization a root
      or package root that is a link in the base commit, or lies below one,
      fails base validation with `config-invalid`, and the message names the
      link. Give the decision in force: resolving links in the base tree was
      rejected, because the base extraction holds regular files only.
- [x] Add the line
      `Status: In progress under the [Windows Paths And Base-Tree Links](../../plans/windows-paths-and-links.md) plan.`
      below the title of the root discovery page.
- [x] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 2: Isolated Git in the large-sources tests

This milestone applies decision 173 A. It changes tests only.

- [x] Add `git_input` to `crates/mokly-compare/tests/support/mod.rs` and
      make `git` delegate to it.
- [x] Replace the private helper of `large_sources_tests.rs` with the
      support module.
- [x] Rerun the probe with a global `commit.gpgsign = true` and
      `gpg.program = false` through `GIT_CONFIG_GLOBAL`, and save the passing
      log as `.context/windows-paths-and-links/item-173-after.log`.
- [x] Run `cargo test -p mokly-compare --test large_sources_tests`.

## Milestone 3: Plain canonical paths in mokly-git and the sidecar

This milestone applies the product part of decision 166. The Clippy rule
waits for the user.

- [x] Add a Windows test first in the `mokly-git` integration tests:
      `SystemDisk::canonicalize` returns a temporary directory without the
      `\\?\` prefix.
- [x] Add `dunce` to `crates/mokly-git/Cargo.toml` with `cargo add`, and
      switch `SystemDisk::canonicalize` and `SystemTable::canonicalize` to
      `dunce::canonicalize`.
- [x] Run `cargo test -p mokly-git -p mokly-sidecar`, Clippy, and
      `cargo clippy --target x86_64-pc-windows-msvc -p mokly-git -p mokly-sidecar --all-targets -- -D warnings`.

## Milestone 4: One path form in the cache location check

This milestone applies decision 179 A.

- [x] Add the regression tests first in
      `crates/mokly-compare/src/_tests_/locations_tests.rs`: on Windows, a
      verbatim cache path below a plain repository path and a verbatim UNC
      path below a plain UNC path are inside; on every platform, a plain path
      below another is inside, and a sibling is not.
- [x] Add `plain` and `inside_repository` to `locations.rs` and use them in
      `SystemLocations::repository`.
- [x] Run `cargo test -p mokly-compare locations`, Clippy, and
      `cargo clippy --target x86_64-pc-windows-msvc -p mokly-compare --all-targets -- -D warnings`.
      The hosted Windows job runs the Windows tests.

## Milestone 5: The loader names the base link

This milestone applies decision 174 C.

- [ ] Add the regression test first in
      `crates/mokly-compare/tests/linked_roots_tests.rs`, and save its
      failure on `main` as
      `.context/windows-paths-and-links/item-174c-main-failure.log`. A base
      commit holds a package root that is a Git link entry, a package root
      below a link entry, and a root that is a link entry. Each base load
      fails with `config-invalid` and the message that names the link. A
      Unix-only test loads the same configurations from the working tree
      with filesystem links.
- [ ] Add unit tests with `SourceTreeMock` in `mokly-catalogue`: the helper
      names a final link and a link above the path, and ends with no link at
      a missing prefix and at a file. Each of the three checks gives the new
      message for a link and its existing message without one.
- [ ] Add `config_links.rs` and call it from `config.rs`, `config_paths.rs`,
      and `config_postcss.rs`.
- [ ] Run `cargo test -p mokly-catalogue`,
      `cargo test -p mokly-compare --test linked_roots_tests`, Clippy, and
      `cargo xtask rust-file-length-lint`.

## Milestone 6: Crate READMEs

The READMEs describe the code of Milestones 3 to 5.

- [x] In the mokly-git README, state that `SystemDisk` resolves canonical
      identities with `dunce`, and update the Key Code line of `disk.rs`.
- [x] In the mokly-compare README, state that the cache location check
      compares both paths in one form, and update the Key Code line of
      `locations.rs`.
- [ ] In the mokly-catalogue README, state that a configured path that
      reaches an unresolved link fails with a message that names the link,
      and add a Key Code line for `config_links.rs`.
- [ ] Remove the status line of the root discovery page.
- [ ] Run `npm run format:check` and
      `npm test -- tests/markdown_links.test.ts`.

## Milestone 7: Verification, commit, review, and handoff

- [ ] Tick items 179, 174, and 173 in `plans/rust-rebuild.md` with the
      decisions, their date, and a link to this plan. Under item 166, record
      the product part and the open Clippy rule. Use the smallest edit.
- [ ] Merge `origin/main` with the `git-merge` skill.
- [ ] Run the targeted tests, `cargo xtask check --suite repository`, and
      then the complete gate `cargo xtask check` once, on the final commit.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest.
- [ ] Hand the branch to the coordinator, who opens the pull request. Put
      its link in the status paragraph when it opens.
