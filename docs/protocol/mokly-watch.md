# Watched Catalogue Development

## Delivery Status

CSS rule attribution and ignored stylesheet owner records are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match).

The [source-path removal plan](../../plans/remove-source-path-evidence.md) records delivery history.

The generation-scoped warning channel and supervisor-factory cleanup are
implemented in [M29](../../plans/remove-source-path-evidence.md#milestone-29-fix-serve-warnings-and-startup-cleanup).
Other watch behavior is implemented.

## Watch Inputs

`mokly serve` watches by default; `--no-watch` serves one deterministic
snapshot. Every development catalogue shell loads the package-owned browser client, which connects to
the versioned event stream. Higher versions refresh background evidence in place
or reload the durable URL when content has changed, as defined by the
[live evidence contract](./mokly-live-evidence.md). Snapshot panes do not run this client. Watch classification
derives from resolved config, both source graphs, and the resources referenced
by generated output:

- the config file and its transitive authoring imports reload configuration, generated
  output, watch targets, and the child;
- resolved entry modules, page/renderer/transformer imports, and every other
  inventoried source rebuild generated output, including imported bytes handled
  by asset loaders;
- a created, renamed, moved, or deleted regular file below a configured root
  that matches one of its `files` globs, including a `.md` document and a
  `_folder.json` folder record, re-runs discovery before that rebuild, so the
  resolved file set follows the filesystem; a rename or move changes the
  entry's path and is paired by the [move contract](./mokly-moves.md), never
  treated as a silent orphan; a changed resource that a Markdown document
  references rebuilds too, because Mokly copies it into generated output;
- an input shared with shell metadata rebuilds before restarting the child;
- configured stylesheets and referenced local CSS, fonts, images, and other
  resources used only through public URLs reload the browser without rebuilding;
- [imported CSS](./mokly-imported-styles.md), including modules, nested
  imports, local assets and PostCSS-reported files, rebuilds from source.
  Plain and module CSS, nested imports, referenced assets, and
  PostCSS-reported files all participate. PostCSS directory dependencies watch
  matching file additions, not deletions, and any newly added non-ignored
  subdirectory beneath the reported directory, even when a reported `*` glob
  does not yet cover it. An absent glob means `**/*`. The PostCSS module and
  its imports reload configuration before rebuilding; the accepted generation
  and browser reload event advance together. Deleting generated output cannot
  trigger a rebuild; generated routes and their symlink aliases never schedule
  a feedback loop;
- a created, renamed, or deleted regular file whose repository-relative path
  matches an `entries` glob re-runs discovery before that rebuild, so the
  resolved entry set follows the filesystem; the glob defines the complete
  entry shape, and the stable prefix of every entry glob is a watched root for
  this purpose;
- an input shared with shell metadata rebuilds before restarting the child;
- configured or component-declared stylesheets and referenced local CSS, fonts,
  images, and other resources used only through public URLs reload the browser
  without rebuilding; every validated declaration is an exact watch target
  from initial startup, even before a full build references it or its component
  renders; after a successful reconfiguration, the replacement watch graph
  includes every newly declared file without waiting for a later build;
- header-proven generated output plus `.git`, `.context`, `node_modules`,
  `dist`, `target`, coverage, browser-test output, comparison output, and Mokly
  transaction trees are pruned from broad watches and classify as ignored;
- additional inputs use the explicit action declared in config.

A root directory is a traversal waypoint, not an exemption for its whole
subtree. A candidate that is an ancestor of, or equal to, the root is never
pruned. Broad traversal evaluates descendants relative to the deepest containing
root, while discovery and file classification evaluate a matched file relative
to the root whose glob matches it. Below that base, only directory segments are
denied, so a regular file named `target` remains ordinary. The denied names are
`.git`, `node_modules`, `.mokly-cache`, `dist`, `coverage`, `target`,
`test-results`, `playwright-report`, `.context`, and segments beginning with
`.mokly-review-` or `.mokly-write-`. Baseline-cache, `review.outDir`,
header-proven generated-output, and export-output rules still apply. Thus an
explicit `dist/specs` root remains reachable, while `src/dist` and
`src/node_modules` are pruned beneath a `src` root, and a root at the repository
root still prunes top-level `.git` and `node_modules`. The discovery walk and
broad watch traversal skip `review.outDir`; matching file events beneath it are
ignored too.

Broad traversal and file classification check non-leaf segments first. A denied
leaf is pruned only when it is a directory. Directory status comes from supplied
watcher stats, else from the event kind: `addDir` and `unlinkDir` are directories;
`add`, `change`, and `unlink` are files. Only a `raw` rename fallback or a direct
call without stats or event evidence needs a directory lookup: each denied-leaf
check uses one `statSync`, treating any failure as a file. Supplied stats avoid that
lookup. Traversal still consults export markers and generated ownership headers.
Thus existing and removed denied directories stay ignored ahead of user rules,
while deleting a matched regular file named `target` rebuilds just like deleting
any other matched file. Watch notifications retain path, kind, and optional
stats through startup gates; resource notifications coalesce by path and deliver
the latest descriptor for that path.

Exact required files, including the config and its imports, inventoried sources,
the renderer, and configured or component-declared stylesheets, retain both their ancestor path and the
file itself even when intentionally nested beneath an ordinarily ignored
directory. Configured and declared stylesheet files remain reload inputs.
Generated output, Review output and the cache take precedence over exact
required inputs; denied directory **names** apply only to discovery and
directory scans, not inventoried files, configured modules or their ancestors.
Classify logical and physical aliases by these distinct reasons before applying
the required-input exception.
Changing a declaration or imported source rebuilds; editing the declared
public file reloads/evidence-refreshes documents rendering its declarer without
an explicit watch rule. See
[component stylesheets](./mokly-component-stylesheets.md).
Those package-owned classifications take precedence over additional watch rules.
A created path beneath a denied directory relative to its root, or beneath
`review.outDir`, is ignored because discovery cannot accept it. A file created
below a root that none of its `files` globs matches and that is not imported
classifies like any other unrelated file. Package source under `node_modules` or
an npx cache is never treated as consumer source. Development of Mokly itself
uses repository tooling rather than a hidden consumer-specific self-reload path.

Header-proven generated output is trusted only when its recorded owner is a
resolved file, an inventoried source, or a repository-relative path below a
configured root matching one of its `files` globs with dotfile matching
enabled. A root at the repository root trusts every matching path and nothing
else. A deleted, renamed, or moved file remains trusted while its old path
still matches, so its stale output is pruned as an orphan while the
[move contract](./mokly-moves.md) pairs the new path with its baseline. Other
Mokly-headered HTML is unclaimed and remains untouched.

Resource discovery follows the same portable HTML/CSS URL rules as Changes,
including transitive imports and nested documents, with shared edges read once
per discovery pass and cycles visited once. External URLs and resource hints
are excluded. Live documents include ignored-region resources in this watch
graph so their rendered chrome refreshes even when Changes remains empty.
Only confined public files and their validated local alias targets are watched;
resource watchers do not follow symlinks. Their lexical paths remain observable
so an invalid or replaced alias can be repaired. Generated files and
package-owned ignored paths remain excluded, preventing output feedback loops.
The logical path of a previously reachable public resource remains a reload
input when its symlink temporarily points outside the repository or dangles;
never watch the escaped physical target. Generated output, Review output and
cache still take precedence, so only an authored public alias can recover.

Build a generation-scoped index of exact required files and their ancestors
once per accepted config/inventory. Ignore callbacks use constant-time set
lookups for exact files and ancestors; descendant checks walk the path's
ancestors without scanning the inventory. Watch targets omit individual files
already covered by an entry glob root, PostCSS directory-dependency root or
watch-rule root unless a denied-name directory lies between that root and a
required file. Such files remain explicit targets, including when they appear
after watcher readiness; their arrival changes the effective watch-target set
and replaces the watcher.
Reconfigure replaces the watcher only when the set of effective watch roots
changes, not when another file joins an already-watched reported directory.
A newly added matching file there causes one rebuild and browser reload
without extra graph loads for watcher replacement.

The repository's `npm run dev` command builds the local CLI once, then runs
watched Serve with `examples/basic/mokly.config.ts`. Arguments after `--`
are forwarded to Serve, for example `npm run dev -- --port 0`. Restarting the
command rebuilds changes to Mokly's own source; this shortcut does not add
watch targets beyond the example's inputs and referenced resources.
Use `npm run -s dev` for Mokly's rich terminal output without npm's outer script
banner; nested build scripts are already quiet.

An unowned public HTML file beneath `mockupsDir` is an authored static input,
not generated merely because of its extension. Reachable HTML resources reload
automatically; an unrelated file can use an explicit reload, restart, rebuild,
or ignore rule. Configured inputs and discovered resources take precedence over
additional rules.

Export markers prove ownership of their listed files, not every descendant of
the output directory. Ignore inventory-listed files and the marker itself, but
traverse the output and its subdirectories so later unowned additions still
reach consumer rules. Owned directory events may be ignored without pruning
traversal. Active transaction trees and the initialized internal reservation
namespace remain pruned. Unowned files still make subsequent export replacement
fail; watch classification does not grant permission to overwrite them.

The source inventory is resolved without evaluating consumer modules before the
source/config watcher is constructed. That watcher becomes ready before the
consumer graph is evaluated or the initial index is prepared, so edits during
evaluation are buffered. Once registry validation accepts the declared
stylesheets, a replacement source watcher adds every declaration and becomes
ready before index completion, child startup, or reported readiness. Keep the
inventory watcher active until its replacement is ready; apply the same
ordering and failure recovery on successful configuration reloading. A declared
CSS edit between evaluation and the replacement becoming ready needs no extra
compensation: Serve reads CSS from disk for each request and starts background
Changes only afterwards. Import changes replace the source watch set with the
same readiness and recovery rules.
Build a generation-scoped index of exact required files and their ancestors
once per accepted config/inventory. Ignore callbacks consult that index in
constant time; watch targets omit individual files already covered by an entry
glob root, PostCSS directory-dependency root or watch-rule root unless a
denied-name directory lies between that root and a required file. Such files
remain explicit targets, including when they appear after watcher readiness;
their arrival changes the effective watch-target set and replaces the watcher.
Reconfigure replaces the watcher only when the set of effective watch roots
changes, not when another file joins an already-watched reported directory.
A newly added matching file there causes one rebuild and browser reload
without extra graph loads for watcher replacement.
Resource watches are discovered from candidate output and become ready before
it is written. Discovery repeats after readiness to capture newly introduced
references during watcher attachment. Notifications during generation and child
startup are buffered. Each notification delivery is isolated: a classifier
exception is reported once, that event is dropped, and later notifications keep
flowing. A child receives the parent-validated catalogue, validates
its source inventory, and binds before
readiness. Child and background warnings follow the
[generation warning contract](./mokly-build-warnings.md#watched-serve-generations).
The shared diagnostic sink flushes before Catalogue ready or failure and
rejects old-attempt records immediately when a newer attempt starts.
Initial startup tries a
requested concrete port and then each higher port in order when the address
is occupied; port `0` delegates selection to the
operating system. The resolved port remains stable across child restarts, which
bind strictly rather than changing the published URL. Exhausting the valid port
range or encountering another bind error exits non-zero without leaking
watchers. An unexpected child failure after readiness reports its diagnostic
once, starts cleanup if the process remains alive, and enqueues a restart through
the same serialized action queue used for authored changes. The supervisor
retains ownership until terminal confirmation; a replacement cannot bypass an
in-progress cleanup or contend with the failed child's still-bound port.

Construct the process supervisor inside the startup cleanup block that owns
the already-created watchers. A throwing injected supervisor factory closes
those watchers before startup rejects; it must not leave a live source watcher.

The supervisor retains the five-minute readiness safety allowance for the child
to receive the accepted config, live index and retained renderer, construct its
catalogue and bind. The interactive performance target is under five seconds;
the timeout is not an acceptable startup duration. Startup transfers no complete
rendered view files and avoids rereading the large manifest file. The retained
graph includes parsed Markdown bodies for demand compilation in each scheme. The child
still validates the transferred metadata and re-resolves the config and consumer
input graphs to enforce source-inventory freshness before binding. These checks
are visible separately with `--debug-timings`. Local controls are available at
readiness. The older full-manifest internal startup path retains its post-ready
runtime handoff; live Serve uses the lightweight pre-ready handoff.

On a config-file change, the parent first loads and validates the candidate,
starts a replacement watcher, waits for readiness and validates a new index and
rendering graph. It then adopts the config, closes the old watcher and restarts
the child. Load, watcher-readiness or index-validation failure retains the previous
config, watcher, output and child. Full rendering and transactional output writing
follow in the background. Their failure preserves old disk output and withholds
complete usage/Changes; valid current previews remain available. An explicit CLI
`--base` remains pinned; without one, the restarted child uses the newly loaded
config's comparison base.

Resource adoption and recovery continue in [Watch Runtime And Recovery](./mokly-watch-runtime.md).
