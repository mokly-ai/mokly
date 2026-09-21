# Mokly MCP Rendering And Comparison Tools

## Scope

This document defines the `mokly mcp` tools that render documents, compare a
view with its Git baseline and validate the catalogue. The common rules,
error codes, bounds and reading tools are in the
[tools and resources contract](./mokly-mcp-tools.md). Types reference the
[component controls request](./mokly-component-controls.md), the
[manifest usage records](./mokly-component-manifest.md) and the
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
  usage: ComponentViewRecord | null;
  browseUrl: string;
  generation: string;
  revision: { content: number; evidence: number };
}
```

Defaults are `desktop` and `light`. Screens and components require a view the
entry actually has; pages ignore viewport and scheme and return the document.
Use cases answer `invalid-input` with a message naming their step screens.
`variantId` selects a saved component variant and defaults to the first. The
tool resolves the view's fragment path from the read model and fetches
`/static/<fragment path>`; the returned HTML is the served document. `usage`
is the view's usage record when ready. A render failure reports
`render-failed` with the generic preview message.

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
  usage: ComponentViewRecord;
  generation: string;
  revision: { content: number; evidence: number };
}
```

The tool sends the controls POST with the exact Host, Origin and token
headers, the current generation and one fresh random 32-hex page id per call,
then fetches the returned preview document. Overrides are passed through
unchanged and validated by the child. HTTP 400 and 413 map to
`invalid-input`, 404 to `unknown-entry`, 409 to `stale-generation`, 422 to
`render-failed` and 429 to `capacity`. On `stale-generation` the tool
refreshes the capability and retries once; a second 409 is returned to the
caller. While the child has no render capability the tool answers
`not-ready`.

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
  reasons: readonly EntryChangeReason[];
  dependencies: readonly string[];
  sharedImpact: readonly string[];
  baseRef: string;
  baseCommit: string;
  generation: string;
  revision: { content: number; evidence: number };
}
```

The tool requests `/__mokly/diffs/review.json?route=…` with `variant` for a
component and `refresh=1` when asked, follows the redirect to the immutable
generation, reads its JSON and fetches the view's `beforePath` and
`afterPath` snapshots relative to that generation. `diff` is a unified
line-level diff of the two documents, empty when a side is missing. Added and
removed entries return the existing side and null for the other without
inventing a comparison. Pages and use cases, ineligible views and a Changes
state other than `ready` answer `comparison-unavailable` with the state in the
message. Comparison generation failures also answer `comparison-unavailable`.
`reasons` come from the v3 `changes` record for the entry or, for v2 results,
from the screen's dependency evidence.

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

The tool runs `mokly check` for the same configuration as a captured
plain-mode subprocess, serializing concurrent calls behind one run, with a
five-minute timeout that kills the process tree and answers `check-failed`.
`files` parses the documented plain success line. A failing check returns
`ok: false` with the CLI error category and message; the tool result itself is
not an error in that case. Cancellation kills the subprocess.

## Verification

- Integration tests against a real watched child and Git fixture for
  `render_view` on a screen, page and component variant; `render_component`
  including the single stale-generation retry and every mapped HTTP status;
  `compare_view` for changed, added and removed entries in v2 and v3
  catalogues and for a pending Changes state; and `check_catalogue` for
  passing and failing catalogues, concurrent calls and cancellation.
- Privacy tests assert that a preview URL, render id, snapshot path or token
  never appears in a result.
