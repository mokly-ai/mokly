# Mokly MCP Rendering And Comparison Tools

## Scope

This document defines the `mokly mcp` tools that render documents, compare a
view with its Git baseline and validate the catalogue. The common rules,
error codes, bounds and reading tools are in the
[tools and resources contract](./mokly-mcp-tools.md). Types reference the
[component controls request](./mokly-component-controls.md), the
[public catalogue read model](./mokly-catalogue.md) and the
[comparison result schema](./mokly-component-review.md).

## Delivery Status

Approved target tracked by the [Mokly MCP server plan](../../plans/mokly-mcp-server.md).

## `render_view`

```ts
interface RenderViewInput {
  id: string;
  viewport?: Viewport;
  colorScheme?: ColorScheme;
  variantId?: string;
}
interface RenderViewResult {
  id: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  variantId?: string;
  html: string;
  truncated: boolean;
  usage: CatalogueUsage;
  browseUrl: string;
  generation: string;
  revision: { content: number; evidence: number };
}
```

Defaults are `desktop` and `light`. Screens and components require a view the
entry actually has; pages ignore viewport and scheme and return the document.
Use cases answer `invalid-input` with a message naming their step screens.
`variantId` selects a saved component variant and defaults to the first. The
tool reads the view's `fragmentPath`, or a page's `documentPath`, from the
read model and requests that `PublicPath` at the child's origin, for example
`/static/screens/home.desktop.html`; the returned HTML is the served
document. A removed entry has a null path and answers `unknown-entry` with a
message pointing to `compare_view` for its baseline. `usage` is the read
model's usage for that view, including its pending or unavailable tag. HTTP
404 answers `unknown-entry`, 400 `invalid-input`, 500 `render-failed` with
the generic preview message, and any other status `internal`.

## `render_component`

```ts
interface RenderComponentInput {
  id: string;
  variantId?: string;
  viewport?: Viewport;
  colorScheme?: ColorScheme;
  overrides: Readonly<
    Record<
      string,
      { kind: "set"; value: ComponentWirePrimitive } | { kind: "unset" }
    >
  >;
}
interface RenderComponentResult {
  id: string;
  variantId: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  html: string;
  truncated: boolean;
  props: ComponentWireProps;
  usage: Extract<CatalogueUsage, { status: "ready" }>;
  generation: string;
  revision: { content: number; evidence: number };
}
```

`variantId` defaults to the first saved variant; `overrides` may be empty,
which renders the saved props through the temporary path. The tool sends the
controls POST with the exact Host, Origin and token headers, the current
generation and one fresh random 32-hex page id per call, then fetches the
returned preview document and projects the response's view record to the
public usage shape. Overrides are passed through unchanged and validated by
the child.

Failures are mapped on the JSON `code` in the response body, with the HTTP
status used only when the body is not the documented JSON: `invalid-input`
and `too-large` answer `invalid-input`; `unknown-entry` answers
`unknown-entry`; `stale-generation` and `forbidden` refresh the capability
and retry once, then answer `stale-generation` or `not-ready` respectively;
`render-failed` and `cancelled` answer `render-failed`; `capacity` answers
`capacity`; `expired` and `method` answer `internal`. While the child has no
render capability the tool answers `not-ready`.

## `compare_view`

```ts
interface CompareViewInput {
  id: string;
  viewport?: Viewport;
  colorScheme?: ColorScheme;
  variantId?: string;
  refresh?: boolean;
}
interface CompareViewResult {
  id: string;
  route: string;
  variantId?: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  state: ReviewState;
  before: { html: string; truncated: boolean } | null;
  after: { html: string; truncated: boolean } | null;
  diff: string;
  diffTruncated: boolean;
  reasons: readonly EntryChangeReason[];
  dependencies: readonly string[];
  sharedImpact: readonly string[];
  baseRef: string;
  baseCommit: string;
  generation: string;
  revision: { content: number; evidence: number };
}
```

`variantId` defaults to the first saved variant for a component. The tool
requests `/__mokly/diffs/review.json?route=…` with `variant` for a component
and `refresh=1` when asked, follows the redirect to the immutable generation,
reads its JSON and fetches the view's `beforePath` and `afterPath` snapshots
relative to that generation. Added and removed entries return the existing
side and null for the other without inventing a comparison. Pages and use
cases, ineligible views and a Changes state other than `ready` answer
`comparison-unavailable` with the state in the message, as do comparison
generation failures. `reasons` come from the v3 `changes` record for the
entry or, for v2 results, from the screen's dependency evidence.

`diff` is a unified diff of the complete untruncated documents, produced by a
package-owned line diff with no runtime dependency: `--- before` and
`+++ after` headers, hunks with three lines of context and standard
`@@ -a,b +c,d @@` headers, and the `\ No newline at end of file` marker. It
is empty when a side is missing or the documents are identical. Output is
deterministic for identical inputs. A diff above 256 KiB is cut at the last
complete hunk under that bound and `diffTruncated: true` is set.

## `check_catalogue`

Input: none.

```ts
interface CheckResult {
  ok: boolean;
  files: number | null;
  generatedOutput: "committed" | "derived";
  error: { category: string; message: string } | null;
  durationMs: number;
}
```

The tool spawns the host's own executable with the same Node binary, the
arguments `check --config <resolved config path>`, and `--debug-timings` when
the host has it, from the repository root with the host's environment plus
`MOKLY_OUTPUT=plain`, so an inherited rich setting cannot change the parsed
output. Standard output is captured; standard error is relayed to the host's
standard error. Before spawning, the tool waits for the host's current
background generation to finish, so a committed-mode check never reads
generated files during a transactional write. A call that arrives while a run
is active waits for it and then starts one fresh run; later callers share that
queued run. A run is killed after five minutes with its process tree and
answers `check-failed`; cancellation does the same.

`files` parses the documented plain success line for the configured mode. A
failing check returns `ok: false` with the CLI error category and message
from the `[mokly/<code>] <message>` line; the tool result itself is not an
error in that case. A subprocess that exits without either documented line
answers `check-failed`.

## Verification

- Integration tests against a real watched child and Git fixture for
  `render_view` on a screen, page, component variant and removed entry;
  `render_component` including empty overrides, the single retry for
  `stale-generation` and `forbidden`, and every mapped code; `compare_view`
  for changed, added and removed entries in v2 and v3 catalogues and for a
  pending Changes state; and `check_catalogue` for passing and failing
  catalogues, a queued concurrent call, an inherited rich output setting, a
  committed-mode check during a background write, and cancellation.
- Diff tests: fixture documents with a pinned expected unified diff, identical
  inputs, a missing side, missing trailing newlines and truncation at a hunk
  boundary.
- Privacy tests assert that a preview URL, render id, snapshot path, token or
  HTTP response body never appears in a result.
