# CI Test Assertions

## Delivery Status

Planned. The approved [vacuous test prevention plan](../../plans/vacuous-test-prevention.md)
owns delivery. This page defines the target contract before implementation.

## Scope

This contract extends [CI verification](./ci-verification.md). The unit guard
covers Node tests in `tests/` and `packages/viewer/tests/`. Checked catalogue
selection and its lint rules cover `tests/`, including Playwright specs.
Playwright assertion counting is outside this contract.

## Zero-Assertion Guard

`scripts/verification/assertion-guard.mjs` is the guard's import entry. Sibling
modules own the resolve hook, counting assertion modules, and test frames.
Each module stays under 300 lines.

The unit runner loads `tsx` first, then the guard, under both its developer and
strict policies. The three native-platform `node --test` steps load the same
imports. A direct run uses:

```bash
node --import tsx --import ./scripts/verification/assertion-guard.mjs --test <file>
```

A run without the guard is partial verification. A claim that code completes
without an error must use `assert.doesNotThrow(...)` or
`await assert.doesNotReject(...)`.

### Process Boundary

The guard acts only when `NODE_TEST_CONTEXT` is set and
`MOKLY_ASSERTION_GUARD_PID` is not set. It then sets
`MOKLY_ASSERTION_GUARD_PID` to its process ID.

The runner's own process has no test context, so the guard does nothing there.
A Node child forked with inherited `execArgv` inherits both variables and does
nothing. Loading the guard must preserve that child's stdout and exit code.
It must not append serialized test-runner events to the child's output.

### Assertion Imports And Counts

A resolve hook registered with `module.register` maps `node:assert`,
`node:assert/strict`, `assert`, and `assert/strict` to counting modules for
imports from files inside the repository root. The guard derives this root
from its own location. Imports from `node_modules` and the guard's own modules
receive Node's real modules.

The default counting export is a `Proxy` over the real assertion module.
Reading a function-valued property counts once. Thus `assert.equal(...)`
counts when the test reads `equal`, without wrapping that function.
Reading `AssertionError`, `Assert`, or `CallTracker` does not count.
The `strict` property returns the counting strict export. A direct call such
as `assert(value)` counts once. Calls to named assertion exports count once.
The counting modules provide the real modules' named exports.

The guard replaces each test context's `assert` property with a counting
`Proxy`. Reads through `t.assert` follow the same counting rule.
The guard never changes Node's `assert` object or replaces its methods.
Loose comparisons through `node:assert` remain loose; its `strict` property
keeps strict behavior. `match`, `doesNotMatch`, and the `rejects` message
"Missing expected rejection" retain Node's behavior.

### Test Frames And Hooks

Root `beforeEach` and `afterEach` hooks register before test files load.
They open and close a frame for each test. Each counted read or call adds one
to every open frame, so a subtest's assertion also gives credit to its parent.
Assertions in the test body, its subtests, and file `beforeEach` hooks count.
Assertions in `afterEach`, `after`, and `t.after()` callbacks do not count,
because the guard's `afterEach` hook closes the frame first.

A test that closes with zero assertions fails with:

```text
test made no assertions: <full test name>
```

`describe` and `it` use the same test-frame rules. A skipped test option,
`t.skip()`, or `t.todo()` exempts that test. The guard wraps each context's
`skip` and `todo` methods to close its frame, because Node 22.14 does not run
`afterEach` after a run-time skip. Later tests must retain correct counts.
A test declared with `todo: true` reports a guard error as a todo failure;
that error does not fail Node's run. The strict runner still rejects skips
and todos under the existing verification policy.

Tests within one file must run sequentially. A test that starts while a test
outside its ancestor chain remains open fails with:

```text
assertion guard needs sequential tests: <open test> is still running
```

Node's default sequential execution within a file satisfies this rule.
Separate test files retain the runner's existing two-file concurrency.

### Assertion Diagnostics And Limits

A failing assertion keeps its caller as the first stack frame. A method read
adds no frame. Direct-call and named-export counting removes the counting
module's own frame from the error stack.

A failing `assert.ok(expression)` without a message retains Node's generated
message with the test's expression. A failing direct call or named `ok` call
without a message shows the counting module's source in that message.
Current test assertion imports are default imports, and no test calls that
default export directly.

The counter counts method reads, so a read without a call also gives credit.
The guard detects zero counts; it does not prove that the assertion checks the
intended behavior. An absence assertion against a stale path can still pass.
Checked selection and lint rules address that failure below.

## Checked Catalogue Selection

`tests/helpers/catalogue_selection.ts` accepts any value with
`entries: readonly ManifestEntry[]`. Each helper returns the manifest's own
entry objects, without copies.

The four selection helpers are preconditions. They throw
`CatalogueSelectionError` when a selection is invalid. They never call
`node:assert`, so a selection alone never counts as an assertion.

| Helper                                                     | Contract                                                                                                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entryAt(manifest, path, kind?)`                           | Return the entry at `path`. Throw if it is missing or has another kind.                                                                                                                                 |
| `entriesAt(manifest, paths, kind?)`                        | Return entries in the requested path order. Throw for a missing, duplicate, or wrong-kind path.                                                                                                         |
| `entriesUnder(manifest, folder, options?)`                 | Return matching entries in manifest order. Match only paths starting with `<folder>/`, excluding the folder's own entry and similarly named sibling folders. Throw when fewer than `min` entries match. |
| `entriesWhere(manifest, description, predicate, options?)` | Return entries that satisfy `predicate` in manifest order. Throw with `description` when fewer than `min` entries match.                                                                                |

`entriesUnder` accepts these options:

- `kind`: one entry kind or a list of kinds. Omitting it permits every kind.
- `variants`: `"include"` by default, `"exclude"`, or `"only"`. An entry with
  `variantOf` is a variant.
- `min`: the minimum match count, with a default of 1.

`entriesWhere` also accepts `min`, with a default of 1.
Kind arguments narrow the result types of `entryAt`, `entriesAt`, and
`entriesUnder`. A component kind accepts both parents and variants.
Selection errors name the helper, path or folder, requested kind or variant
filter, and match count. Predicate errors include their description.

Shared single-entry lookups use `entryAt`: `designDocument` in
`tests/helpers/design_catalogue.ts` and `componentParent` in
`tests/helpers/component_views.ts`.
`componentParent` keeps its variant check and throws `CatalogueSelectionError`
when the selected entry is a component variant.

### Absence Assertions

`assertAbsent(manifest, path)` is an assertion. It first checks that its
anchor contains entries. The anchor is the parent folder of `path`, or `path`
itself when the path contains no `/`. An empty anchor throws
`CatalogueSelectionError`. A live anchor proves that the assertion still
checks a real catalogue area.

After that precondition, the helper uses `node:assert/strict` to assert that
no entry has the exact path. A present path raises `AssertionError`. An absent
path under a live anchor passes and counts as an assertion.

## Catalogue Selection Lint

`eslint.config.js` adds `no-restricted-syntax` rules for
`tests/**/*.{ts,tsx}`, excluding `tests/helpers/catalogue_selection.ts`.
`packages/viewer/tests` has no catalogue selections and remains outside the
lint scope. Each diagnostic names the checked helper to use.

The rules reject these syntax shapes:

1. A direct loop over `.entries` with an immediate `if` whose consequent is
   `continue`, or a block containing only `continue`. Use `entriesUnder` or
   `entriesWhere` to check the selection before the loop.
2. A selection call directly on `.entries` that filters `entry.path` through
   `startsWith` or `endsWith`. Use `entriesUnder` or `entriesWhere`.
3. A selection call directly on `.entries` that compares `entry.path` with a
   literal or template literal using `===` or `!==`. Use `entryAt` for one
   path, `entriesAt` for a path list, or `assertAbsent` for absence.

The selection-call methods are `filter`, `flatMap`, `find`, `findLast`,
`findIndex`, `some`, and `every`. The exact selectors are:

```text
ForOfStatement[right.type='MemberExpression'][right.property.name='entries'] > BlockStatement > IfStatement:matches([consequent.type='ContinueStatement'], [consequent.type='BlockStatement'][consequent.body.length=1][consequent.body.0.type='ContinueStatement'])
CallExpression[callee.object.property.name='entries'][callee.property.name=/^(filter|flatMap|find|findLast|findIndex|some|every)$/] CallExpression[callee.property.name=/^(startsWith|endsWith)$/][callee.object.property.name='path']
CallExpression[callee.object.property.name='entries'][callee.property.name=/^(filter|flatMap|find|findLast|findIndex|some|every)$/] BinaryExpression[operator=/^[!=]==$/][left.property.name='path'][right.type=/^(Literal|TemplateLiteral)$/]
```

Helper calls and `entries.map` remain allowed. Assertions such as
`assert.ok(entry.path.startsWith(...))`, an inner-loop `continue`, a loop over
`Object.entries(...)`, and filters on another object's `path` remain allowed.

### Lint Limits

The rules inspect syntax only. They do not find selections from arrays
derived from `entries`, comparisons with variables, or content filters in
inner loops. A test that reaches no assertion through those forms still fails
the unit guard. A test with another assertion can pass, so reviewers must
still check that each selection tests the intended catalogue entries.
