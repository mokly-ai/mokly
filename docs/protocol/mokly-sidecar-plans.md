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
counted in serialized bytes. A compile whose plan does not fit this bound
returns no plan. When a `bundle` response would pass the
[frame limit](./mokly-sidecar.md#transport), the sidecar drops the plan
before it drops the reuse evidence. A dropped plan changes no other field of
the result.
Decision: the plan stays beside `compiled`, on the wire and in the bundle
cache. A plan inside the compiled recipe was rejected, because each
`restoreGeneration` would carry it. A separate durable plan entry was
rejected, because it needs its own publication rules. A separate 8 MiB plan
allowance was rejected, because one record could then use 16 MiB.

## Kept Records

Only the core of a Serve head keeps plan records. It keeps a record only from
the result of a `full` request that a sidecar of the same process compiled or
accepted. That result needs a plan, complete and durable evidence, and a known
toolchain identity. The core keeps the last such record of each set of bundle
settings, compared without the evaluation digest. A record stays after the
release of its generation. A `serveEdit` request keeps no record and replaces
none.
Decision: the core keeps the records and sends a plan with each edit request,
so any worker can take the request. A record in one sidecar, with edits
routed to it, was rejected, because it adds worker routing and record
restoration. Plan copies installed in workers were rejected, because they add
installed-state bookkeeping.

The kept records of one process use at most 8 MiB in total. The total counts
the serialized bundle settings, plan, and evidence of each record, with the
evaluation digest cleared. A record that does not fit alone is not kept. A
new record replaces the record of equal settings, and then the oldest records
leave until the total fits.
Decision: the total counts the kept settings, because the core must keep no
settings outside its bound. A settings digest, settings in the pair bound, and
estimated heap bytes were rejected. They add hashing on each edit, a changed
pair rule, or an unmeasured size model.

A later `full` result that gives no record keeps the older record of equal
settings. The older record keeps its own evidence, and the core checks that
evidence before each edit.
Decision: the older record stays, because a later capture does not weaken the
proof of its own evidence check. Removal of the older record at each `full`
capture was rejected, because it loses valid reuse. The replacement rule of
released recipes was not copied, because those recipes have another owner and
lifetime.

## Edit Requests

Before each `serveEdit` request, the core takes the record of the request's
bundle settings. It checks the evidence of that record under the
[reuse evidence rules](./mokly-sidecar-recipes.md#reuse-and-identity). When
every recorded input is unchanged, the request carries the plan in the
optional request-only `plan` value. Otherwise the request carries no plan, and
its compile starts with the native attempt. A changed input does not remove
the record. A later edit uses the record again when every recorded input
matches again.
Decision: a record needs complete and durable evidence. Complete evidence
alone was rejected. A path that changes during the capture can leave complete
evidence with a module selection that a fresh compile would change. A reused
plan would keep that selection for every later edit.

The `plan` value, like `capture`, is not a bundle setting. The sidecar removes
it before it compares settings, computes the compilation identity, restores a
recipe, or checks the recipe size. Only a `serveEdit` request carries a plan.
A plan changes no reuse rule and no identity rule. A compile with a plan makes
one esbuild call: the planned attempt, with no native attempt. An import
outside the plan uses full resolution. Apart from the fresh identity of each
edit compile, the result or the error equals that of the same request without
a plan. A failed planned attempt fails the request, and no other attempt
follows. Plan reuse adds no setting, gate, retry, or process.
Decision: a current plan replaces the native attempt and its classification.
Import keys that each compile resolves again were rejected, because they keep
the classification and add resolver round trips. A kept esbuild build context
was rejected, because it keeps both attempts and the classification.

One changed input makes the whole record unusable. New bundle settings, such
as an added catalogue entry, need their own record.
Decision: a record is checked and used as a whole. A check of each plan entry
and a record key of the resolution settings alone were rejected, because each
adds an evidence index or a second key without a measured need.

## Warm Start

A [bundle cache entry](./mokly-base-cache.md#bundle-entries) can keep the plan
of its compilation beside the compiled bundle. `restoreGeneration` carries no
plan, also for a stored compilation. When a sidecar accepts a stored
compilation, the `bundle` result carries the stored plan of that entry. The
pool matches the entry and the result by the runtime import key of the
compilation. A raw read of the bundle cache never gives a record. The core of
a Serve head keeps the record of an accepted entry under the rules above, so
the first edit of a warm session can use it.
