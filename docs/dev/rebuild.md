# Rebuild Procedures

Procedures for the [Rust rebuild plan](../../plans/rust-rebuild.md): how the
frozen TypeScript backend's outputs are captured as references, and how each
Rust milestone runs its gap sweep. [`AGENTS.md`](../../AGENTS.md) holds the
always-on rules; this document holds the steps.

## Reference Capture

Run once before the teardown, from the `ts-backend-final` tag, with the old
CLI built from that tag. Save everything under `.context/rust-rebuild/reference/`,
which Git ignores. The references are guidance, not an oracle: the Rust core
may differ where the spec says so.

Scenarios, one directory each:

| Directory          | Repository state                                                           |
| ------------------ | -------------------------------------------------------------------------- |
| `example`          | the example catalogue at the tag, built, served, and exported              |
| `large/<scenario>` | the large fixture's four benchmark scenarios                               |
| `moved-screen`     | the example with one screen file moved and its `movedFrom` hint absent     |
| `removed-screen`   | the example with one screen deleted                                        |
| `markdown-edit`    | the example with one document's body changed                               |
| `ignore-edit`      | the example with a change inside a paired Review-ignore region only        |
| `renderer-change`  | the example with a renderer edit that changes head styles for every screen |

For each scenario keep the manifest, the generated tree listing with blob
hashes, the review artifact, the catalogue read model, the export inventory,
and the terminal output of build, check, serve startup, and export. Then run
the behaviour-table script, `scripts/rebuild/behaviour-table.mjs` at the tag,
which reduces a scenario to one JSON table: entries by kind and path, listed
changes with states and reasons, affected consumers, kept and excluded rules
per view, and resource closures per view.

## Gap Sweep

Each Rust milestone that replaces a subsystem runs one bounded sweep before it
closes. The sweep is a reading exercise against the frozen contracts and the
old test names, not a port.

1. List the frozen contracts and the test files that owned the subsystem, from
   the protocol triage under `.context/rust-rebuild/protocol-triage.md`.
2. For each rule or test case, decide one of three outcomes with one line of
   reason: adopt, adopt with a change, or drop.
3. Write the adopted and changed rules into the new spec page in the same
   change. Dropped rules need no record beyond the sweep file.
4. Produce the behaviour table from the Rust core for every captured scenario
   and compare it with the reference table. Put each difference into one bin:
   an improvement the spec already states, a spec gap to close before the
   milestone closes, or a regression to fix.
5. Save the sweep and the comparison under
   `.context/rust-rebuild/sweeps/<milestone>.md` and name that file in one
   line under the milestone in the plan.

Accepted differences are listed in the breaking-change release note. A
regression blocks the milestone.

## Protocol Triage

Every page under `docs/protocol` carries one classification in the triage
file: keep (true for both lines, kept as is), rewrite (true in spirit,
rewritten for the Rust core in the milestone that owns the subsystem), or
delete (describes the frozen implementation only, removed at the teardown).
The [protocol index](../protocol/README.md) groups pages by that
classification until the rewrite milestones replace it with the final index.
