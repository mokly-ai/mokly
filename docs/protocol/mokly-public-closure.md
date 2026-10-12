# Public File Policy And Referenced Closure

## Delivery Status

This contract defines the implemented public-file boundary tracked by
[Generated Output Simplification](../../plans/generated-output-simplification.md).
It applies to compilation, on-demand rendering, Watch, Serve, export and
publication. The [source protection contract](./mokly-source-protection.md)
defines which authored inputs remain private.

## One Policy Per Compilation

One generation-scoped policy owns the decision for each catalogue-relative
authored path. Resolve its logical and physical location, source membership,
protected-location membership and regular-file status once per compilation.
Cache both accepted and rejected decisions by normalized path. Configured
stylesheets, renderer resource declarations and the transitive link walk reuse
this same instance. Create a new instance after every source/config/resource
change; do not retain filesystem decisions across accepted generations.

The policy rejects unsafe or escaping paths, hidden path segments, symbolic
links at any path component, nonregular files, the manifest, cache, Review and
export/transaction output, consumer dependency/package trees, and every input
protected by the source inventory or reserved source-name rules. Keep the
existing denial precedence and source-specific explanation. It does not reject
an otherwise valid authored file merely for a `.js`, `.ts`, `.map` or other
extension, or a directory named `dist`, `target`, `coverage`, `test-results` or
`playwright-report`. Actual inputs and actual protected locations remain private.
Unreferenced files remain private regardless of their names.

Configured package roots may contain the catalogue or sit strictly inside it;
an inner package tree remains private. A package root equal to `mockupsDir`,
after realpath resolution fails export capture with `export-invalid` and:

```text
A consumer package root must not equal mockupsDir; choose a separate public output directory.
```

This is an export-policy check. Config loading, Build and Serve do not add
this rejection. Ancestor roots such as `packageRoots: ["."]` remain supported.

Entry discovery and PostCSS scanning skip the actual configured generated
directory and its aliases by path. An unrelated directory named
`mokly-generated` is not excluded by that name alone. Other discovery and
hidden-name rules retain their current meaning. Do not change the unresolved
source-root equality or Review-root overlap rules.

## One Closure Builder

Build, requested-document compilation, resource Watch, Serve and both
publication paths use one closure builder. Its inputs are the accepted
generated documents, pending compiled CSS/assets, renderer-declared resources,
the public-file policy and an explicit full/on-demand traversal mode.
Return the sorted unique authored closure and traversal evidence for watching:
per-file references, logical locations and invalid recovery targets.

Use the existing shared HTML/CSS reference parser. Include ordinary `<a href>`,
`data-nav-href`, resource hints such as preload, `<iframe>`, `srcset`, CSS imports
and URLs, and explicit renderer resource seeds. Ignore external/data URLs under
the current URL rules. Decode and confine relative local paths, retain fragment
validation, and walk authored HTML and CSS transitively. Read each file and
visit each edge set once per pass; handle cycles without recursive duplication.
Binary resources retain their exact bytes and have no parsed child links.

A renderer resource declaration is a closure starting point even without an
HTML link. Retain each valid CSS path and its transitive references after
discarding only its ownership claim. Authored paths enter `assetClosure`;
generated paths remain in the accepted generated inventory. Watch and Serve
use the same checked result. Closure membership alone supplies no CSS Changes
reason, component proof or inserted-link provenance.

Every renderer resource seed passes the same policy and existence checks as a
document link before it enters the closure. A declaration cannot bypass source
protection, authorize a symlink or make an unlisted file public. A failure names
the declaring/referring generated route. Link/seed traversal retains
`build-invalid`. Authored renderer resources and stored component resources
retain the existing component-resource validation path and policy cause:

```text
component resource is not a public file: <path> (<reason>)
```

`<path>` is the declared public path. `<reason>` is the shared policy denial,
or `missing, non-regular, or outside mockupsDir` for an unavailable file.
Validate before ignoring CSS ownership or recording a seed. Both boundaries
use the same public-file policy. Link diagnostics are:

```text
document links and resources are invalid:
- <route>: protected target <reference>: <reason>
- <route>: missing target <reference>
```

Sort diagnostics deterministically. Preserve existing URL/anchor diagnostics.
In on-demand mode, add and walk authored link destinations. Stop traversal at
generated page links: resolve their registered identity and check required
anchors through the existing requested-document mechanism, but do not render
the whole generated catalogue merely to discover its closure.

Full compilation and a successful full Watch pass produce identical closures
for identical input bytes. Watch can retain invalid logical locations and prior
edges solely so a repair triggers another pass. Invalid/recovery evidence never
adds serving authority. Serve replaces its full closure only with a successful
checked result; on-demand additions belong only to the same accepted generation.
A checked result replaces only the checked closure. The on-demand additions of
the same generation remain until the generation changes.
A failed candidate retains the last accepted generation and its authority.
A running server can adopt a new source generation before its checked result,
for example after a resource reload or a rebuild that keeps the manifest
structure. It then keeps the last checked closure and drops only the on-demand
additions of the earlier generation. The update that announces the generation
must not make a file in the checked closure return 404.

A resource reload reuses the earlier compilation, so the manifest closure of a
completed reload pass can be older than the watched closure. Each completion
therefore carries the parent's current checked closure, and the child serves
that list instead of the manifest closure. An update message carries no list,
so it cannot change the checked closure. A restarted watched child starts
with the last checked closure unless the parent reloaded the config file. This
covers a restart watch rule, crash recovery and a structural rebuild, including
a rebuild whose new imports replace the source watcher. After a config-file
change, the new child starts without a checked closure, because the earlier
list can name files that the new configuration does not reference. Until its
first checked result, it serves only the on-demand additions of its own
generation.

## Serve Reads And Publication

Membership in the accepted closure is necessary but not sufficient at read
time. Serve rechecks confinement and every path component, opens the final file
without following a symbolic link, and verifies the open handle is a regular
file. GET and HEAD apply the same rule. A missing, replaced, protected or
unlisted resource returns 404; no unchecked watcher list can authorize it.
The compilation cache does not replace these read-time checks.

Export and publication capture only accepted generated bytes and this authored
closure. Their input-stability checks use the same policy and closure builder.
They do not enumerate the public directory to find extra assets. Keep exact
binary bytes, manifest/cache privacy, ownership, collision checks and rollback.

## Acceptance

Write failing regressions before implementation. Use one fixture with a linked
authored page, PDF, `data-nav-href`, preload, iframe, `srcset`, CSS dependencies
and renderer resources. Assert exact equality between compiler and Watch
closures. Fetch the linked page and PDF through watched Serve before and after
resource changes. In-process, adopt a new generation before its checked result:
the checked PDF stays readable, and a file that only an on-demand render of the
earlier generation added returns 404. After two resource reloads, the second
completion keeps the PDF that the first reload linked, although the reused
manifest closure lacks it. Block the background write of a structural rebuild:
the restarted child still serves the checked PDF. A rebuild that adds an
import outside the entry roots also keeps the list. After a config-file change,
the new child receives no list. Verify protected declarations fail with the
referring route.
Replace an accepted file and an ancestor with symlinks and require GET/HEAD 404.

Exercise allowed authored script/map/build-folder names and denied actual
inputs through Build, Serve, export and publication. Restore the package-root
equality test, including an alias. Test an unrelated `mokly-generated` source
folder beside the actual ignored output root. Instrument repeated configured
stylesheet and link references to prove one policy decision per authored path
per compilation, then prove that a new compilation rechecks changed files.
