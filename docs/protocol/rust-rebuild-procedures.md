# Rust Rebuild Procedures

Procedures of the [Rust rebuild plan](../../plans/rust-rebuild.md): how the
previous backend's outputs are captured as references, and how each milestone
runs its gap sweep against the previous protocol before it closes. The plan
names the commit that holds the previous protocol and the `ts-backend-final`
tag that pins it.

## Reference Capture

Run once before the teardown, from the `ts-backend-final` tag, with the old
CLI built from that tag. Save everything under `.context/rust-rebuild/reference/`,
which Git ignores. The references are guidance, not an oracle: the Rust core
may differ where the spec says so.

Scenarios, one directory each:

| Directory          | Repository state                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `example`          | the example catalogue at the tag, built, served, and exported                                                                             |
| `large/<scenario>` | the large fixture's four benchmark scenarios                                                                                              |
| `moved-screen`     | the example with one screen file moved and its `movedFrom` hint absent                                                                    |
| `removed-screen`   | the example with one screen deleted                                                                                                       |
| `markdown-edit`    | the example with one document's body changed                                                                                              |
| `ignore-edit`      | the example with a change inside a paired Review-ignore region only                                                                       |
| `stylesheet-edit`  | the example with one changed rule that matches rendered elements and one changed rule that matches none, in a stylesheet that screens use |
| `renderer-change`  | the example with a renderer edit that changes head styles for every screen                                                                |

For each scenario keep the review artifact, the catalogue read model, the
export inventory, and the terminal output of build, check, serve startup, and
export; the previous manifest and generated tree are not kept, because the
Rust core writes neither. Then run
the behaviour-table script, `scripts/rebuild/behaviour-table.mjs` on the
rebuild branch, over the saved outputs; it reduces a scenario to one JSON table: entries by kind and path, listed
changes with states and reasons, affected consumers, kept and excluded rules
per view, and resource closures per view.

## Gap Sweep

Each Rust subsystem replacement runs one bounded sweep before its milestone
closes. The sweep is a reading exercise against the previous protocol and the
old test names, not a port.

1. List the previous protocol pages and the test files that owned the
   subsystem, read at the commit the plan names.
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
