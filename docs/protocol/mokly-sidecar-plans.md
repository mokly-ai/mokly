# Serve Edit Plans

These rules extend the [compiled recipe rules](./mokly-sidecar-recipes.md) of
the `bundle` request. They let a Serve edit compile skip resolution work that
an earlier compile in the `full` mode did, with an equal result.

## Native And Planned Attempts

A compile without a plan starts with a native attempt, in which esbuild
resolves each import itself. The sidecar then classifies the native result.
The resolution plan maps the imports that the native attempt resolved to the
modules that the [module source rules](./mokly-sidecar-modules.md) select.
When the native result differs from its plan, a planned attempt compiles again
with the plan. A planned attempt gives each import outside its plan the full
resolution of the module source rules. A failed native attempt gives no plan.
The compile then uses full resolution for every import.

## Plan Records

A captured compile is a compile in the `full` mode. A plan record pairs the
plan of one captured compile with the reuse evidence of that same compile.
The plan comes from the native attempt, also when the native result stands.
A captured compile with complete and durable evidence returns its plan in the
optional `plan` field of the `bundle` result, beside `compiled`. The evidence
crosses once, inside `compiled`. A `serveEdit` compile returns no plan.
`restoreGeneration` requests and released recipes carry no plan. A missing or
dropped plan changes neither the reuse nor the storage of a compilation.

The plan and the reuse evidence of one record use at most 8 MiB together,
counted in serialized bytes. The count includes the path table and the
candidate names of the plan. When a `bundle` response would pass the
[frame limit](./mokly-sidecar.md#transport), the sidecar drops the plan
before it drops the reuse evidence. A dropped plan changes no other field of
the result.
Decision: the plan stays beside `compiled`, on the wire and in the bundle
cache. A plan inside the compiled recipe was rejected, because each
`restoreGeneration` would carry it. A separate durable plan entry was
rejected, because it needs its own publication rules. A separate 8 MiB plan
allowance was rejected, because one record could then use 16 MiB.

A plan with candidate names that does not fit this bound loses its candidate
names and the path table rows that only those names added. The compile then
counts the plan again. A compile whose plan still does not fit returns no
plan.
Decision: candidate names are an optional layer of the plan, so the bound
removes that layer before it drops the plan. A drop of the whole plan was
rejected, because the same plan without candidate names can fit.

## Plan Format

The plan lists each path once, in its path table. A planned import gives its
importer and its target as positions in that table. It also gives its
specifier, its import kind, and whether its target can have side effects.
Each set of [candidate names](#candidate-names) gives its directory as a
position in the same table. A position outside the table makes the plan
malformed, like any other plan field that does not match its type. A
`bundle` result with a malformed plan is a malformed frame under the
[fail-closed rules](./mokly-sidecar.md#fail-closed-rules). A bundle cache
entry with a malformed plan has a payload that does not parse, so the entry is
[damaged](./mokly-base-cache.md#bundle-entries). No edit uses a malformed
plan.
Decision: the plan stores each path once, so that candidate names fit both
bounds on a large catalogue. A path in each planned import was rejected,
because repeated absolute paths fill most of the plan bytes. A larger bound
was rejected, because the bound limits memory. A count of compressed bytes
was rejected, because it does not limit decoded memory.

## Kept Records

Only the core of a Serve head keeps plan records. It keeps a record only from
the result of a `full` request that a sidecar of the same process compiled or
accepted. That result needs a plan, complete and durable evidence, and a known
toolchain identity. A record stays after the release of its generation. A
`serveEdit` request keeps no record and replaces none.
Decision: the core keeps the records and sends a plan with each edit request,
so any worker can take the request. A record in one sidecar, with edits
routed to it, was rejected, because it adds worker routing and record
restoration. Plan copies installed in workers were rejected, because they add
installed-state bookkeeping.

The resolution settings of a request are its bundle settings without the
entry files, the stories files, the renderer, and the evaluation digest. The
core keeps the last record of each set of resolution settings. Compiled reuse
and the bundle cache keep their own comparison of bundle settings.
Decision: the core keeps a record by its resolution settings, because the
settings that it leaves out cannot change the target of a planned import. A
key of every bundle setting except the evaluation digest was rejected,
because an added catalogue entry then finds no record while every recorded
input stays unchanged.

The kept records of one process use at most 8 MiB in total. The total counts
the serialized resolution settings, plan, and evidence of each record. A
record that does not fit alone is not kept. A new record replaces the record
of equal resolution settings, and then the oldest records leave until the
total fits.
Decision: the total counts the kept settings, because the core must keep no
settings outside its bound. A settings digest, settings in the pair bound, and
estimated heap bytes were rejected. They add hashing on each edit, a changed
pair rule, or an unmeasured size model.

A later `full` result that gives no record keeps the older record of equal
resolution settings. The older record keeps its own evidence, and the core
checks that evidence before each edit.
Decision: the older record stays, because a later capture does not weaken the
proof of its own evidence check. Removal of the older record at each `full`
capture was rejected, because it loses valid reuse. The replacement rule of
released recipes was not copied, because those recipes have another owner and
lifetime.

## Edit Requests

Before each `serveEdit` request, the core runs the plan check on the record
of the request's resolution settings. The plan check compares the evidence of
that record with the filesystem under the
[reuse evidence rules](./mokly-sidecar-recipes.md#reuse-and-identity), with
the exception for [candidate names](#candidate-names). When every recorded
input matches, the request carries the plan in the optional request-only
`plan` value. Otherwise the request carries no plan, and its compile starts
with the native attempt. A changed input does not remove the record. A later
edit uses the record again when every recorded input matches again.
Decision: a record needs complete and durable evidence. Complete evidence
alone was rejected. A path that changes during the capture can leave complete
evidence with a module selection that a fresh compile would change. A reused
plan would keep that selection for every later edit.

The `plan` value, like `capture`, is not a bundle setting. The sidecar removes
it before it compares settings, computes the compilation identity, restores a
recipe, or checks the recipe size. Only a `serveEdit` request carries a plan.
A plan changes no compiled-result reuse rule and no identity rule. A compile with a plan makes
one esbuild call: the planned attempt, with no native attempt. An import
outside the plan uses full resolution. Apart from the fresh identity of each
edit compile, the result or the error equals that of the same request without
a plan. A failed planned attempt fails the request, and no other attempt
follows. Plan reuse adds no setting, gate, retry, or process.
Decision: a current plan replaces the native attempt and its classification.
Import keys that each compile resolves again were rejected, because they keep
the classification and add resolver round trips. A kept esbuild build context
was rejected, because it keeps both attempts and the classification.

One changed input makes the whole record unusable. An added catalogue entry
leaves the resolution settings unchanged, so the next edit takes the same
record. The imports of the new entry are outside the plan and use full
resolution.
Decision: a record is checked and used as a whole. A check of each plan entry
was rejected, because it needs an evidence index for each import, and a
shared observation has no single owning import.

## Candidate Names

The candidate names of a recorded directory hold every name whose entry can
change the result of the compile. These are the names that esbuild can look
up in that directory during the compile, also in a lookup that fails. They
include the fixed names that esbuild reads in each directory that it visits,
such as `package.json`, `tsconfig.json`, `node_modules`, and the Yarn
Plug'n'Play files. They include the name of each child directory that a
lookup passes through. A captured compile adds the candidate names of its
recorded directories to its plan. A directory gets no candidate names when
the capture cannot derive all of them, or when a candidate or recorded entry
name is not ASCII.

Only a compile with esbuild 0.28.2 records candidate names. A compile with
another esbuild version records none, and it does not fail for that reason.
Decision: only esbuild 0.28.2 gives candidate names, because its lookup names
were read from its source. Narrowing for every version was rejected, because
another release can look up other names. A build error for another version
was rejected, because the whole comparison stays exact.

Only the plan check uses candidate names. The reuse checks of compiled
results, released recipes, and stored compilations compare whole directories
under the [reuse evidence rules](./mokly-sidecar-recipes.md#reuse-and-identity).
A directory without candidate names keeps its whole comparison in the plan
check too. Candidate names change only whether an edit request carries a
plan. A compile with a plan still gives the result or the error of the same
request without a plan.
Decision: only the plan check copies esbuild lookup rules, so an error in
those rules cannot reach compiled reuse or a stored compilation. Candidate
names in the shared reuse evidence were rejected, because they would put that
risk on every reuse owner.

In a directory with candidate names, the plan check compares each entry whose
name equals a candidate name, with ASCII letters compared without case. A
non-ASCII entry in the current directory makes the record unusable.

For each compared entry, the presence, the exact name, the kind, and the real
target of a link must match the recorded listing. The real path of the
directory must still equal its recorded path. Any other entry can appear,
change, or leave, and the directory still matches. A read error, or an entry
name that is not valid Unicode, makes the record unusable.
Decision: names match without ASCII letter case. Non-ASCII names keep whole
comparisons, because esbuild folds letter case differently from Rust and
JavaScript. Exact-case matching was rejected, because a new case variant of
a candidate name can change what esbuild finds.

## Warm Start

A [bundle cache entry](./mokly-base-cache.md#bundle-entries) can keep the plan
of its compilation beside the compiled bundle. `restoreGeneration` carries no
plan, also for a stored compilation. When a sidecar accepts a stored
compilation, the `bundle` result carries the stored plan of that entry. The
pool matches the entry and the result by the runtime import key of the
compilation. A raw read of the bundle cache never gives a record. The core of
a Serve head keeps the record of an accepted entry under the rules above, so
the first edit of a warm session can use it.
