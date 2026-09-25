# Watched Catalogue Development

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
- for [imported CSS](./mokly-imported-styles.md), changed plain/module
  CSS, nested imports, referenced assets, and PostCSS-reported files rebuild;
  PostCSS directory dependencies watch matching file additions, not deletions,
  and any newly added non-ignored subdirectory beneath a reported directory,
  even when its reported glob is `*` and did not yet cover the new child;
  deletion of generated output cannot start a rebuild. An absent glob means
  `**/*`. The PostCSS module and its imports reload config before
  rebuilding; the accepted generation and browser reload event advance together;
  generated output, including symlink aliases, never schedules a rebuild loop;
- a created, renamed, or deleted regular file whose repository-relative path
  matches an `entries` glob re-runs discovery before that rebuild, so the
  resolved entry set follows the filesystem; the glob defines the complete
  entry shape, and the stable prefix of every entry glob is a watched root for
  this purpose;
- an input shared with shell metadata rebuilds before restarting the child;
- configured stylesheets and referenced local CSS, fonts, images, and other
  resources used only through public URLs reload the browser without rebuilding;
- header-proven generated output plus `.git`, `.context`, `node_modules`,
  `dist`, `target`, coverage, browser-test output, comparison output, and Mokly
  transaction trees are pruned from broad watches and classify as ignored;
- additional inputs use the explicit action declared in config.

An entry glob's stable prefix is a traversal waypoint, not an exemption for its
whole subtree. A candidate that is an ancestor of, or equal to, the prefix is
never pruned. Broad traversal evaluates descendants relative to the deepest
containing prefix, while discovery and entry-candidate classification evaluate
a matched file relative to the deepest root whose glob matches that file. Below
that base, only directory segments are denied, so a regular file named `target`
remains ordinary. The denied names are `.git`, `node_modules`, `.mokly-cache`, `dist`,
`coverage`, `target`,
`test-results`, `playwright-report`, `.context`, and segments beginning with
`.mokly-review-` or `.mokly-write-`. Baseline-cache, `review.outDir`,
header-proven generated-output, and export-output rules still apply. Thus an
explicit `dist/entries/**` root remains reachable, while `src/dist` and
`src/node_modules` are pruned beneath a `src/**` root, and repository-root globs
still prune top-level `.git` and `node_modules`. The discovery walk and broad
watch traversal skip `review.outDir`; matching file events beneath it are
ignored too.

Broad traversal and entry classification check non-leaf segments first. A denied
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
the renderer, and configured stylesheets, retain both their ancestor path and the
file itself even when intentionally nested beneath an ordinarily ignored
directory. Configured stylesheet files remain reload inputs.
The logical path of a previously reachable public resource remains a reload
input when its symlink temporarily points outside the repository or dangles;
never watch the escaped physical target. Generated output, Review output and
cache still take precedence, so only an authored public alias can recover.
Generated output, Review output and the cache take precedence over exact
required inputs; denied directory **names** apply only to discovery and
directory scans, not inventoried files, configured modules or their ancestors.
Classify logical and physical aliases by these distinct reasons before applying
the required-input exception. Those package-owned output classifications take
precedence over additional watch rules.
A created path beneath a denied directory relative to its glob root, or beneath
`review.outDir`, is ignored because discovery cannot accept it. A file created
under an entry glob root that no `entries` glob matches and that is not imported
classifies like any other unrelated file. Package source under `node_modules` or
an npx cache is never treated as consumer source. Development of Mokly itself
uses repository tooling rather than a hidden consumer-specific self-reload path.

Header-proven generated output is trusted only when its recorded owner is a
resolved entry module, an inventoried source, or a repository-relative path
matching a configured entry glob with dotfile matching enabled. As the
glob-based trust branch, a repository-root glob trusts every path matching that
glob and nothing else. A deleted or renamed entry remains trusted while its old
path still matches, so its stale output is pruned as an orphan. Other
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

The input graphs are resolved before the source/config watcher is constructed.
It becomes ready before initial index preparation; import changes replace its watch
set using the same readiness and recovery rules as configuration adoption.
Build a generation-scoped index of exact required files and their ancestors
once per accepted config/inventory. Ignore callbacks consult that index in
constant time; watch targets omit individual files already covered by an entry
glob root or PostCSS directory-dependency root. Reconfigure replaces the
watcher only when the set of effective watch roots changes, not when another
file joins an already-watched reported directory. A newly added matching file
there causes one rebuild and browser reload without extra graph loads for
watcher replacement.
Resource watches are discovered from candidate output and become ready before
it is written. Discovery repeats after readiness to capture newly introduced
references during watcher attachment. Notifications during generation and child
startup are buffered. Each notification delivery is isolated: a classifier
exception is reported once, that event is dropped, and later notifications keep
flowing. A child receives the parent-validated catalogue, validates
its source inventory, and binds before
readiness. Initial startup tries a requested concrete port and then each higher
port in order when the address is occupied; port `0` delegates selection to the
operating system. The resolved port remains stable across child restarts, which
bind strictly rather than changing the published URL. Exhausting the valid port
range or encountering another bind error exits non-zero without leaking
watchers. An unexpected child failure after readiness reports its diagnostic
once, starts cleanup if the process remains alive, and enqueues a restart through
the same serialized action queue used for authored changes. The supervisor
retains ownership until terminal confirmation; a replacement cannot bypass an
in-progress cleanup or contend with the failed child's still-bound port.

Continue with [watched adoption and recovery](./mokly-watch-lifecycle.md).
