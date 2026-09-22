# Mokly MCP Tools And Resources

## Scope

This document defines the common rules, the catalogue reading tools and the
resources exposed by [`mokly mcp`](./mokly-mcp.md). The
[rendering and comparison tools](./mokly-mcp-render-tools.md) follow the same
rules. Types reference the [public catalogue read model](./mokly-catalogue.md).

## Delivery Status

Approved target tracked by the [Mokly MCP server plan](../../plans/mokly-mcp-server.md).

## Common Rules

- `tools/list` returns, in this order: `get_status`, `search_entries`,
  `get_entry`, `list_changes`, `render_view`, `render_component`,
  `compare_view`, `check_catalogue`. The complete `tools/list` result and the
  `initialize` `instructions` text ship as the package fixture
  `docs/protocol/fixtures/mcp-tools-v1.json`, and a conformance test compares
  the live server against it byte for byte. Every result carries the same data
  as `structuredContent` and as one text content block of canonical JSON.
- The `instructions` text is: "Mokly catalogue for this repository. Use
  search_entries to find screen, page, use-case and component ids before
  linking or editing; never guess an id. After editing a screen or component,
  call render_view to check the served result and list_changes or
  compare_view to see what changed against the Git base. Run check_catalogue
  before finishing. Changes and usage can be pending while the catalogue
  builds; report pending states rather than assuming nothing changed."
- Every result includes `revision: { content, evidence }` from the catalogue
  snapshot it read. Rendered results also include the on-demand `generation`.
- Ids and saved variant ids use the catalogue id grammar
  `^[a-z0-9]+(?:-[a-z0-9]+)*$`, the same grammar authoring validates.
  Viewports are `mobile` or `desktop`; color schemes are `light` or `dark`.
- `limit` must be an integer of at least 1, otherwise `invalid-input`; a value
  above the tool's cap is clamped to the cap.
- URLs in results are absolute on the loopback Browse origin reported by
  `get_status`, for example `http://127.0.0.1:4173/view/account/home.html`.
- Changes and usage states are reported exactly as the read model reports
  them: `preparing`, `pending`, `ready`, `unavailable` and `disabled`. Every
  value derived from usage records carries its own status tag; a tool never
  converts an unknown state into `unmodified`, an empty list or zero.
- Usage in results is the read model's ready shape
  `{ instances, slots, ranges }`; the private style and resource ownership
  tables of the manifest record are never included.
- Documents are UTF-8 HTML text. A document above 512 KiB is cut at the last
  complete line under that bound and `truncated: true` is set. Inputs above
  64 KiB are rejected with `invalid-input` before any request is made.
- Tool failures use `isError: true` with `structuredContent`
  `{ code, message }`. Codes are `invalid-input`, `unknown-entry`,
  `not-ready`, `stale-generation`, `render-failed`, `capacity`,
  `changes-unavailable`, `comparison-unavailable`, `check-failed`, `closing`
  and `internal`. Messages are product language without paths or internal
  identifiers, and HTTP response bodies are never copied into them.
- Filesystem paths, render tokens, render ids, preview URLs, snapshot paths,
  Git commands, source bytes and the private manifest never appear in any
  result or notification.

## Reading Tools

### `get_status`

Input: none. Never waits for readiness.

```ts
interface StatusResult {
  phase: "starting" | "ready" | "replacing" | "closing";
  url: string | null;
  base: string;
  generatedOutput: "committed" | "derived";
  changesStatus: ChangesStatus;
  revision: { content: number; evidence: number } | null;
  counts: {
    screens: number;
    pages: number;
    useCases: number;
    components: number;
  } | null;
  version: string;
}
```

`url` is the loopback Browse URL for a human to open. Counts come from the
read model and are null before readiness.

### `search_entries`

```ts
interface SearchInput {
  query?: string;
  kinds?: readonly (
    "screen" | "page" | "use-case" | "component" | "collection"
  )[];
  changed?: boolean;
  limit?: number;
}
interface SearchResult {
  entries: readonly {
    id: string;
    kind: CatalogueEntry["kind"];
    title: string;
    route: string | null;
    tags: readonly string[];
    breadcrumbs: readonly string[];
    changes: CatalogueChanges;
  }[];
  total: number;
  revision: { content: number; evidence: number };
}
```

`query` uses the Browse search grammar: whitespace-separated terms, `tag:`
terms that must all match, and the remaining phrase matched case-insensitively
against id, title and route. `changed: true` keeps entries whose Changes state
is ready and `included`; when Changes is not ready the tool answers
`changes-unavailable`. `limit` defaults to 50 and is capped at 200; `total`
is the count before the limit. Entries sort by route then id; collections sort
by id after routed entries. Removed entries are included with their baseline
breadcrumbs when the query matches.

### `get_entry`

```ts
interface EntryInput {
  id: string;
}
interface EntryResult {
  entry:
    | CatalogueCollection
    | CatalogueScreen
    | CataloguePage
    | CatalogueUseCase
    | CatalogueComponent;
  breadcrumbs: readonly string[];
  browseUrl: string | null;
  usedBy:
    | {
        status: "ready";
        entries: readonly {
          entryId: string;
          kind: "screen" | "component";
          variantId?: string;
          viewport: Viewport;
          colorScheme: ColorScheme;
          instances: number;
        }[];
      }
    | { status: "pending" | "unavailable" };
  revision: { content: number; evidence: number };
}
```

`entry` is the read-model record. For a component, `usedBy` aggregates the
usage records of every screen view and saved-variant view that instantiates
it; it is `ready` only when every such view's usage is ready, otherwise the
status names the reason and no entries are listed. Other kinds report `ready`
with no entries. `browseUrl` is the `/view/<route>` Browse URL; collections
have none. Unknown ids answer `unknown-entry`.

### `list_changes`

```ts
interface ListChangesInput {
  kinds?: readonly ("added" | "changed" | "removed")[];
  limit?: number;
}
interface ListChangesResult {
  status: ChangesStatus;
  base: string;
  entries: readonly {
    id: string;
    kind: CatalogueRoutedEntry["kind"];
    title: string;
    route: string;
    change: ChangeKind;
    breadcrumbs: readonly string[];
    views: readonly {
      viewport: Viewport;
      colorScheme: ColorScheme;
      variantId?: string;
      comparison: ComparisonSelection;
    }[];
    affectedConsumers:
      | {
          status: "ready";
          entries: readonly {
            id: string;
            kind: "screen" | "component";
            route: string;
          }[];
        }
      | { status: "pending" | "unavailable" };
  }[];
  total: number | null;
  revision: { content: number; evidence: number };
}
```

When `status` is not `ready`, `entries` is empty and `total` is null rather
than zero. Entries are the read model's routed entries whose Changes are ready
and `included`, plus removed entries, sorted by route then id; unmodified
entries never appear. `views` copies each view's comparison eligibility.
`affectedConsumers` lists screens and components whose usage records
instantiate a changed component, derived from the read model only, and is
`ready` only when every consulted usage record is ready. `limit` defaults to
100 and is capped at 500.

## Resources

`resources/list` returns `mokly://catalogue` and one entry per packaged guide.
`resources/templates/list` returns `mokly://guides/{section}/{slug}`. Both
lists are deterministic: the catalogue first, then guides in the section and
`order` sequence of the [guides contract](./mokly-guides.md).

### `mokly://catalogue`

`application/json`, the current public catalogue read model bytes as served
by `/__mokly/catalogue.json`. Subscribing sends
`notifications/resources/updated` for this URI after each accepted `ready` or
`update` event; notifications coalesce while a read is pending and carry no
data. Unsubscribing stops them. A read waits for readiness under the server
contract's bounded wait, then answers `-32001` with `data.phase`.

### `mokly://guides/{section}/{slug}`

`text/markdown`, the packaged guide at `docs/guides/<section>/<slug>.md` with
its frontmatter removed and its title prepended as a level-one heading. A URI
whose section or slug does not match the guides contract grammar answers
`-32602`; a well-formed URI that names no packaged guide answers `-32002`.
Guides never change while the process runs and send no notifications.

## Verification

- Schema tests: every tool's `inputSchema` and `outputSchema` reject the
  documented invalid inputs and accept the documented valid ones.
- The `tools/list` result and `instructions` match the shipped fixture.
- Fake-gateway unit tests per tool for every result shape, error code, bound,
  default, clamp and truncation rule, including pending and unavailable usage
  tags.
- Privacy tests asserting no result or notification contains a filesystem
  path, the render token, a render id, a preview URL, manifest bytes or source
  bytes.
- Resource tests for guide reads, malformed and unknown URIs, the bounded
  catalogue wait, subscription notifications and coalescing.
- Integration coverage is listed with the
  [rendering and comparison tools](./mokly-mcp-render-tools.md#verification).
