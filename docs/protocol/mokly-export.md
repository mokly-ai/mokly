# Consumer Static Export

## Delivery Status

The consumer CLI, shared engine, and repository preview reuse artifact
validation, [static delivery](./mokly-export-delivery.md), and one transaction.
Serve/export share the viewer's server-rendered, hydrated React shell; consumer
and comparison frames remain static. Build and comparison contracts stay
authoritative. Exports use path identity and nested artifact directories.

## Scope

Current files, comparisons and removed previews follow the exact
[generated inventory rule](./mokly-export-public-files.md#generated-inventory),
including entries named like build directories. Imported CSS capture uses
accepted in-memory stylesheet and opaque asset bytes under the
[unified output contract](./mokly-unified-output.md). Private stylesheet and
PostCSS inputs never enter the static inventory. Validate decoded relative links
to scoped npm assets against accepted routes; copied scoped-package assets are
generated public output. Export never walks the generated tree on disk.

An installed consumer can create a complete static Mokly catalogue using
their existing config, roots, renderer, and assets. The resulting directory
contains Browse navigation, screens, use cases, pages, Markdown documents, and
the existing on-demand comparison experience. Hosting it requires no Mokly
process, consumer source tree, Node.js, or Git on the serving machine.

Mokly owns artifact generation. Consumers own deployment, credentials,
domains, access control, and host configuration. Export performs no upload,
Git fetch, commit, push, npm publication, or hosting-account operation.

## CLI Contract

The installed CLI supports:

```bash
npx mokly export --out .context/mokly-site
npx mokly export --config docs/mokly.config.ts --out ../site --base main
```

- `export` is a new subcommand in the existing executable and npm package.
- `--out <directory>` is required. A relative path resolves against the loaded
  config's directory, consistently with configured filesystem paths; an
  absolute path is accepted only inside `repoRoot`. No default is introduced.
- `--config <path>` uses existing CLI config discovery and resolution.
- `--base <ref>` overrides `review.base`; omission uses that setting, whose
  existing default is `origin/main`. Never hardcode the example's config or base.
- `--help` lists these rules without loading config or touching output.
- Missing values, empty output, unknown/extra arguments, and `--port`,
  `--watch`, or `--no-watch` on `export` fail as CLI errors.
- `--out` remains invalid on `serve`, `build`, and `check`. The removed
  `review` command is not restored. The separate [`publish` command](./mokly-upload.md)
  runs this exporter then uploads its result; export itself never uploads.
  No new config section is introduced.
- Success exits zero after installation and prints the output directory plus
  the instruction to deploy its contents as the site's document root.
- Failure exits non-zero with an actionable existing error category or the
  new typed `export-invalid` category. Normal author errors do not print stacks.

Existing `build` and `check` retain their generated-fragment and manifest
contracts. Export itself performs the normal build, so a separate consumer
build command is not required. Normal config evaluation and compilation retain
their existing execution boundary; export adds no hosting network calls.

## Baseline And Comparisons

The `export` command always requests Changes; an incompatible base follows the
[baseline contract](./mokly-baseline-compatibility.md). `publish --no-changes` uses
the same transactional engine with current-only assembly, no baseline reads,
and the same source/public-byte consistency checks. It omits removed entries,
diff files and comparison controls; delivery metadata has a null comparison URL.
Current-only assembly skips historical rebuilds and uses compiled generated
bytes while still detecting authored source/resource changes.
The separate repository preview keeps its optional Changes contract.
A comparison export requires a Git checkout with `HEAD`, the selected base,
and their merge base. Per-commit selection reads complete Git blobs or rebuilds
the pinned commit before capture under the
[baseline contract](./mokly-derived-baselines.md). CI must fetch
sufficient history before invoking the command; export never fetches it.
Missing or invalid baselines fail explicitly, including shallow history.
Recognized earlier output is the one exception: export succeeds with Changes
unavailable, no history files, and the exact diagnostic defined by
[baseline compatibility](./mokly-baseline-compatibility.md).

Resolve and pin one merge-base commit for the operation. Both entry-level
Changes attribution and screen comparisons use that commit, the same current
manifest/generated documents, and the same changed-path exclusions. Apply the
shared Changes calculation to captured public bytes: normalize paired ignored
regions, compare reviewable metadata, and follow rendered local resources.
Ignored-only edits, source moves, and dependency/shared-impact evidence alone
do not add entries, except the owned and exact declared paths of [component attribution](./mokly-component-changes.md#dependencies-and-styles).
Retain that evidence in comparisons, and do not derive the navigation filter by counting materially changed comparison screens.

Comparisons use [review result v6](./mokly-changes-serving.md#comparison-engine) for
every catalogue. It retains all existing states, shared/dependency impact,
ignored regions, both viewports and all effective color schemes; see the
[supported format matrix](./README.md#supported-formats). Removed screens,
pages, documents, components and variants retain their baseline context; current
and removed records never share a path within a kind. Pages and documents have
no visual comparisons. A path absent from one side follows the added/removed
rules unless the [move contract](./mokly-moves.md) pairs it. A declared but
missing baseline document, invalid manifest, or unavailable resource fails; none
becomes an invented empty baseline. Empty registries retain the normal build
error; export does not weaken registry validation to create an empty site.

Comparisons use private temporary storage, independent of `review.outDir` and
any running development server. Exclude the final export directory, its
temporary stage/backup/lock paths, and their resolved aliases from entry and
comparison change attribution before broad dependencies/shared-impact globs
are evaluated. Exporting twice must not make the export affect its own Changes.
Watch also ignores owned export artifacts and export transaction paths before
broad rules, without ignoring unrelated authored files with similar names.

## Generation Lifecycle

1. Parse options, load config, validate output boundaries and export ownership, and
   reserve the resolved output against concurrent export writers.
2. Resolve the comparison baseline without changing the checkout; complete
   a cached rebuild if the pinned commit has no complete generated inventory.
   Compile and validate the current catalogue entirely in memory. Never write
   the head `mokly-generated/` tree.
3. Capture the current manifest, documents, required assets, and changed-path
   evidence into one export input snapshot. Build the comparison against the
   pinned baseline using those inputs; validate any source/public input reads
   again before installation. A detected mid-export input change aborts with
   a retry instruction instead of mixing generations.
   Generated bytes come from the compilation during capture and recheck;
   authored public assets still use confined filesystem reads. Recheck the
   unchanged completion marker for the pinned commit before installation.
4. Generate into a private sibling stage on the output filesystem. Use the
   same catalogue, shell rendering, Browse document adapter, browser module
   graph, and comparison engine as development. An ephemeral loopback server
   may be used, but no watcher or persistent process is started.
5. Assemble all routes and resources defined by the static delivery contract.
   Validate every file path against the ownership contract's portable-path
   rule when it enters the collision-checked inventory. Finalize the deployment
   identity from every staged file except the ownership marker and any
   publication metadata path declared by the adapter. Stamp that identity into
   the owned catalogue and shell documents, then hash the exact final bytes of
   every file, including publication metadata, and add the schema 3 marker
   last. Verify internal references, ownership, all route and directory-prefix
   collisions including the marker path, and complete local dependency closure
   before writing the stage. A regular file over 64 MiB fails as
   `export-invalid` before staging. The marker and declared publication
   metadata are excluded from identity only; both remain owned and hashed by
   the marker.
6. Drain generation work and close temporary servers before installing the
   stage. Replace owned output with rollback protection, then clean owned
   temporary resources and release the writer reservation.

Failure or SIGINT/SIGTERM before installation restores the captured previous
export when recovery is safe. A concurrently recreated destination is preserved
alongside the retained backup instead of being overwritten. Export never writes
catalogue output. A post-install
cleanup failure retains the installed site and identifies remaining recovery
paths. The [export recovery contract](./mokly-export-recovery.md) defines
captured-backup validation, bounded deletion, restoration conflicts, and primary
versus cleanup error propagation. There is no cross-process atomicity guarantee
for arbitrary edits to the repository or private reservation namespace.

Cancellation is checked again after ownership validation and after the old
directory moves to backup. The final stage-to-output rename is the commit point;
once started it is drained along with cleanup, not interrupted mid-rename.

A non-portable candidate fails with this exact product message, where `path`
is interpolated with `JSON.stringify` so invisible characters are visible and
no file content is exposed:

```text
[mokly/export-invalid] The export path ${JSON.stringify(path)} is not portable. Rename that file or folder, then export again.
```

`JSON.stringify` supplies the quoted representation. Because JSON permits DEL
and C1 controls as literal characters, the exporter renders any category Cc
character still present in that representation as lowercase `\uXXXX` before it
reaches the terminal.

## Output Safety

Output confinement and ownership reservations follow the separate
[export safety contract](./mokly-export-safety.md).

The output inventory and imported CSS capture continue in
[Export Public Files And Package Boundary](./mokly-export-public-files.md);
the [ownership marker](./mokly-export-ownership.md) records exact file bytes.
