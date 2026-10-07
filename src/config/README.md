# Configuration and discovery

This internal boundary resolves `MoklyConfig` from a config file. Filesystem paths
are config-relative; source paths retained in manifests are repository-relative.
Unknown configuration fields fail with `config-invalid`. Root path prefixes
cannot start with `mokly-generated`, compared case-insensitively.
The removed `review.sharedImpact` input is the explicit exception: it warns
and has no effect. `ReviewConfig` rejects its values with `?: never`, including
in assigned or spread objects. Explicit `undefined` also fails when
`exactOptionalPropertyTypes` is enabled.

`roots.ts` validates source directories, safe file globs, path prefixes and
transparent directory names. Omission selects `[{ dir: "specs" }]` with
`**/*.mockup.{ts,tsx}` and `**/*.md`. Every root must retain a file after exclusions.

`entry_discovery.ts` projects shared filesystem identities once, walks roots in
configuration order without following directory symlinks, and returns a fresh
inventory. One file cannot belong to two roots, including through physical aliases.
The retained `rootByFile` index ensures that a file's actual matching root supplies
its prefix even when a deeper root selects different files. Folder exclusions select entries after matching files; all matches remain protected
inputs, including unimported excluded files. Exclusions match file paths only.
Directory records also have one root owner, even with disjoint entry globs.

Matched Markdown files become document entries through `src/documents`; their
sources and copied-resource inputs remain private and watched. They never enter
the executable bundle. `_folder.json` files supply folder metadata, remain
private, and join the graph's source inventory. Entry, document and metadata edits
trigger the appropriate rebuild without making generated output public source.

`paths.ts`, `path_validation.ts`, `entry_membership.ts` and `public_files.ts` share
lexical and physical confinement with Build, Serve, Review and export. Review and
export destinations cannot overlap the directories holding matched inputs. Source
protection is based on the resolved file set and complete graph inventory.
Path projection retries a vanished ordinary ancestor at most five times.
Dangling symlinks still fail. An internal manifest that disappears between an
existence check and realpath is absent; lexical metadata denials still apply.
`public_names.ts` owns pure lexical rules for copied Markdown resources.
`public_denial.ts` owns authored-closure privacy shared with export, using
configuration and projected filesystem paths.

```sh
node --import tsx --test tests/config*.test.ts tests/entry_discovery*.test.ts
node --import tsx --test tests/path_roots.test.ts tests/watch_glob*.test.ts
```

See the [configuration contract](../../docs/protocol/mokly-configuration.md),
[source protection](../../docs/protocol/mokly-source-protection.md), and
[watch contract](../../docs/protocol/mokly-watch.md).

`root_membership.ts` denies current root matches before candidate acceptance,
so newly created or invalid source files cannot become public during a rebuild.
Historical resource reads retain their validated snapshot inventory.

`postcss.ts` and `postcss_loader.ts` load the optional consumer PostCSS module;
the loader normalizes plugins through `../build/styles/postcss_calls.ts`;
`reserved_paths.ts` keeps root directories, file-glob prefixes and authored styles
outside `mokly-generated/`, including aliases. Broad roots skip that output tree.

`cache_paths.ts` names the private `.mokly-cache/` directory and recognizes
its paths and aliases. `cache_ignore.ts` publishes `.mokly-cache/.gitignore`,
which matches every cache path, so Git ignores the cache.
