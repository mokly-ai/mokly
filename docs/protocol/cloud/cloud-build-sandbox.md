# Cloud Build Sandbox

This sub-contract of [Cloud build runner](./cloud-build-runner.md) defines the
one-shot sandbox of each attempt, the output stream of its processes and the
reconciliation of sandboxes that outlive their attempt. The runner defines the
request, the outcomes, the steps and the budgets. The
[template contract](./cloud-build-template.md) defines the template.

## Sandbox

Each attempt creates one sandbox with `create_sandbox`: `sandbox_id` is the
build ID, `operation_id` the attempt operation ID, `owner` the project ID with
no agent, `consumer` `SandboxConsumer::Runtime`, `deployment_id`
`MKC_E2B_DEPLOYMENT_ID`, `profile` `build`, `network`
`SandboxNetworkPolicy::Open` and `lifetime` `SandboxLifetime::OneShot` for the
remaining attempt budget plus 120 seconds, at most 3600. The `build` profile
uses `MKC_E2B_BUILD_TEMPLATE`, public egress, and denies
`240.0.0.0/4`, `64:ff9b::/96` and `ff00::/8` plus every `MKC_E2B_DENIED_DESTINATIONS`
entry, on top of the adapter's private, loopback, link-local (including
metadata) and multicast list. It lists no IPv4-mapped IPv6 range: the adapter
canonicalizes those to IPv4, so `::ffff:0:0/96` would deny all IPv4 egress,
and the IPv4 entries already cover mapped destinations.
It also lists no `0.0.0.0/8` range (decided 2026-11-24). E2B rejects every
denied range that starts at `0.0.0.0`, except `0.0.0.0/0`, so a create that
lists one fails. So no deny rule covers `0.0.0.1` to `0.255.255.255`: E2B's
own default deny list leaves the range out too, because its firewall cannot
encode it. Whether a build can reach an address in the range depends on
routing outside the sandbox. The rejected alternative was 22 narrower ranges
that cover `0.0.0.1` to `0.255.255.255`.
The pinned adapter's built-in multicast rule covers IPv4 only; the build
profile adds `ff00::/8` for IPv6. `mkc-build-sandbox::policy::denied_destinations`
returns the profile rules as canonical, sorted, unique IPs and CIDRs. The
composition root passes them to the backend's public-egress `build` profile;
the create request selects that profile rather than carrying a deny list.

An unavailable create is ambiguous: the runner calls only
`recover_sandbox_create` with the same request, and `None` ends the attempt as
`Infrastructure`. The runner destroys the sandbox after every outcome,
including a failing sink or a dropped run; the lifetime is the backstop. It
never pauses, resumes or connects to another attempt's sandbox.
The runner requires a Tokio runtime with time enabled. A dropped run starts
recover-only cleanup for an ambiguous create, or destroys its known sandbox.
Cleanup has a 120-second bound; runtime shutdown leaves the lifetime as the backstop.
If destruction after an outcome fails or times out, the runner logs a warning
with only the build ID, attempt operation ID and safe failure fact. It keeps
the decided outcome and excludes provider error text and identifiers from
the warning. Reconciliation and the one-shot lifetime remove the sandbox.

## Output

The runner drains every stream promptly into an in-memory buffer per stream
and hands chunks to the sink off the reading task, so persistence never
stalls the stream. It removes both token values from the bytes before any
chunk leaves the buffer, holding back the last (longest value − 1) bytes until
more output or the stream's end so a value split across events is still
caught; each occurrence becomes `[redacted]`. Once a second has passed or the
buffer holds 64 KiB, the runner cuts after the last newline within the first
64 KiB, or at the limit when there is no such newline. At a limit cut it moves
back at most three bytes, only when the suffix before the cut is a valid prefix
of a UTF-8 sequence that the bytes after the cut could complete. Otherwise it
cuts at the limit. Every cut makes progress while eligible bytes remain.
One timer tick cuts one partial chunk; remaining bytes below the size limit
wait for the next tick or stream end. An incomplete UTF-8 prefix waits for
the next event, even at a timer cut.
A finished stream drains completely, including an incomplete
final sequence, with no chunk larger than 64 KiB. Apart from token redaction,
invalid bytes reach the log unchanged; the API's display decoder replaces
them. Chunks carry the attempt, step and stream
(`stdout`, `stderr` or `system`).
Queued output is bounded by the per-stream caps. Sink delivery has the process's
remaining absolute budget, with one extra second to flush its final chunks;
stalled delivery is `Infrastructure`. No later process starts after the attempt deadline.

`system` lines are the runner's own: `$ <argv>` before each process, and
`exit <code>`, `no output for <n> minutes` or `stopped at the time limit` after
it. For display only, the executable and each argument stay unquoted when
nonempty and made only of `A-Za-z0-9@%+=:,./_-`. Otherwise they use single
quotes; an empty value is `''`, and an apostrophe becomes `'\''` inside the
quoted value. This is the selection rule of Python's `shlex.quote`, with the
existing single-quote escaping. For example, `$ git init --quiet
/workspace/repo` and `$ git config --local credential.helper 'store
--file=/home/user/.mokly-git-credentials'`. System lines never contain a token.
Persistence, caps and reads are in the [build API](./cloud-build-api.md#listbuildlog).

## Reconciliation

Every five minutes the worker calls `list_managed_sandboxes` for
`MKC_E2B_DEPLOYMENT_ID` and destroys each listed sandbox whose `sandbox_id` is
not a `running` build, whose `operation_id` is not that build's
`attempt_operation_id`, or whose identifiers are missing. The deployment ID
is exclusive to builds, so no other consumer's sandbox is listed. Destroy
failures retry on the next pass; the lifetime bounds any leak.

## Verification

The runner's unit tests also cover the exact create request and final deny
list; destroy on every path; outcome preservation and safe warnings after a
destroy failure; redaction across event boundaries; chunk cutting;
backpressure; and display quoting. Chunk regressions prove progress through
invalid UTF-8 runs longer than 64 KiB, complete final draining and the chunk
size cap.
