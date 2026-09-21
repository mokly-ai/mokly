# Mokly MCP Server

Add `mokly mcp`, a local Model Context Protocol (MCP) server over stdio, so
coding agents can search the catalogue, render screens and components, read
Changes, compare a view with its Git baseline, validate the catalogue, and read
the packaged guides without a browser. The command is a thin host over the
existing Serve runtime: it supervises the same watched Serve child, reaches it
over loopback HTTP with the Host, Origin and render-token rules the shell
already obeys, and exposes the public catalogue read model, rendered documents,
selected comparisons and the guides through typed tools and resources. The
server never writes source files, generated output or Git state.

There is no new user interface, so this plan has no mockup milestone.

## Findings that shape the design

- The [public catalogue read model](../docs/protocol/mokly-catalogue.md) at
  `/__mokly/catalogue.json` already carries the navigation tree, every entry's
  details, per-view fragment paths, per-view component usage records and
  per-entry Changes state with content and evidence revisions. Search, entry
  details, Changes rows and component consumers are projections of it.
- `/static/<fragmentPath>` renders the requested view on demand through the
  bounded worker described in [on-demand Serve](../docs/protocol/mokly-on-demand.md),
  so rendering a view is one GET.
- Temporary component rendering is the private POST in the
  [controls contract](../docs/protocol/mokly-component-controls.md). Its token
  is minted inside the Serve child by `ComponentRenderService` and reaches only
  the shell descriptor, so the supervising parent needs a typed IPC message to
  learn it.
- `/__mokly/diffs/review.json?route=…&variant=…` from the
  [selected comparison contract](../docs/protocol/mokly-selected-comparisons.md)
  returns an immutable generation with before and after documents.
- `/__mokly/events` publishes versioned `ready`/`update` events, and watched
  Serve keeps its first resolved port across child restarts, so one event
  consumer can drive resource-update notifications.
- The watched child is forked with inherited stdout, and consumer render code
  or workers may print to it. MCP stdio reserves stdout for JSON-RPC, so the
  command must remap child stdout to stderr and keep every reporter line off
  stdout.
- `tests/guides_cli.test.ts` requires one CLI guide per public command and
  agreement between documented options, the parser and `--help`;
  `tests/guides_structure.test.ts` and `scripts/package/archive.mjs` enumerate
  guide files. The guide therefore lands in the same milestone as the command.
- `@modelcontextprotocol/sdk` 1.30.0 implements protocol revision 2025-11-25
  and installs about ninety packages, including Express, Hono and JOSE, none of
  which a stdio server uses. The audit passed at the time of planning.

## Decisions

1. **Transport implementation.** Implement the stdio JSON-RPC framing and the
   MCP method set in `src/mcp/` without a new runtime dependency. The stdio
   surface is small: newline-delimited JSON-RPC 2.0, `initialize`,
   `notifications/initialized`, `ping`, `tools/list`, `tools/call`,
   `resources/list`, `resources/templates/list`, `resources/read`,
   `resources/subscribe`, `resources/unsubscribe`, `notifications/cancelled`
   and `notifications/resources/updated`. This keeps the production dependency
   list and the packed-consumer audit small and matches the repository's typed
   boundary style. Alternative: depend on the SDK; revisit if an HTTP transport
   is ever required.
2. **Protocol revision.** Negotiate `2025-11-25` and accept `2025-06-18` and
   `2025-03-26` when a client requests them. The stateless 2026-07-28 revision
   (`server/discover`, `subscriptions/listen`) leaves stdio compatible through
   its probe-and-fall-back rule; adopting it is post-merge work.
3. **Always supervised, always watched.** `mokly mcp` reuses the watched Serve
   lifecycle so a failing consumer renderer cannot take the MCP process down and
   edits made by the agent are picked up. `--watch`, `--no-watch`, `--open` and
   `--out` are refused for `mcp`.
4. **Loopback gateway, not in-process service calls.** Tools reach the child
   over HTTP through the same routes and admission rules as the browser shell.
   The only new IPC message carries the render capability to the parent.
5. **Read-only tools.** No tool writes files, runs Git, builds output or
   publishes. `check_catalogue` runs the CLI `check` as a captured subprocess so
   validation semantics stay identical to the command and consumer code never
   executes in the MCP process.
6. **Honest evidence.** Tools report `pending`, `unavailable` and `disabled`
   Changes states exactly as the catalogue does and never invent comparison,
   usage or count data.

## Milestone 1: Protocol and documentation

Define the complete contract before any code changes.

- [ ] Write `docs/protocol/mokly-mcp.md`: scope and delivery status; the `mcp`
      command and its options; stdio framing; handshake and version
      negotiation; advertised capabilities, `serverInfo` and agent-facing
      `instructions`; readiness rules (handshake answers immediately, tool
      calls wait a bounded time for the child, `get_status` never waits);
      output discipline (stdout exclusive to JSON-RPC, diagnostics on stderr,
      child stdout mapped to stderr, no stdin shortcuts); shutdown on stdin
      end, `SIGINT` and `SIGTERM`; child restart behavior; the security
      boundary (loopback only, no file paths accepted, source protection and
      manifest privacy unchanged, token custody, result size bounds); and the
      required verification list.
- [ ] Write `docs/protocol/mokly-mcp-tools.md`: for each tool its name, input
      schema, `structuredContent` and text output, error codes and bounds;
      the `mokly://catalogue` resource with subscription semantics and the
      `mokly://guides/{section}/{slug}` resources; deterministic tool and
      resource ordering; `revision` and `generation` fields on every result.
      Tools: `get_status`, `search_entries`, `get_entry`, `render_view`,
      `render_component`, `list_changes`, `compare_view`, `check_catalogue`.
- [ ] Update `docs/protocol/README.md`, the CLI list and option table in
      `docs/protocol/mokly-package.md`, the output-mode rules in
      `docs/protocol/mokly-terminal-output.md`, the token custody paragraph in
      `docs/protocol/mokly-component-controls.md`, and the event-consumer note
      in `docs/protocol/mokly-live-evidence.md`.
- [ ] Update `README.md`: feature summary, CLI table row, a short
      "Use Mokly with a coding agent" section, and a Key Code entry for
      `src/mcp`.
- [ ] Validate the changed Markdown with Prettier and review the diff.

## Milestone 2: Serve host seams

Backend-only changes that let a supervising host use Serve without touching
stdout or the HTTP admission rules. Serve's own behavior is unchanged.

- [ ] Add failing tests first: child stdio mapping, render-capability message
      parsing and rejection of malformed messages, the parent accessor, and a
      reporter environment that writes only to stderr.
- [ ] Let `ChildFactory.spawn` accept a stdio target so the MCP host forks the
      child with `["ignore", 2, 2, "ipc"]` while Serve keeps inheriting.
- [ ] Have the child send a typed `render-capability` message whenever its
      `ComponentRenderService` is created or replaced; validate it in the
      parent, retain only the latest `{ token, generation }`, expose it through
      `RunningServe.renderCapability()`, and keep it out of every diagnostic and
      timing record.
- [ ] Expose the same accessor from the in-process `RunningServer` so both Serve
      paths share one seam.
- [ ] Export the shell search grammar (`parseSearchQuery`, `rowMatchesQuery`)
      from `@mokly/viewer/data` with tests so `search_entries` shares Browse
      semantics without duplication; keep the browser-graph check passing.
- [ ] Update `src/server/README.md` and `src/server/controls/README.md`.

## Milestone 3: MCP core and the `mokly mcp` command

After this milestone an agent can connect, see the tool list, read status,
search the catalogue and read entry details and guides.

- [ ] Add failing tests first: framing (one message per line, invalid JSON
      answers `-32700`, unknown methods answer `-32601`), version negotiation,
      deterministic `tools/list`, `resources/list` and `resources/read`,
      subscribe and unsubscribe, `ping`, cancellation, and stdout exclusivity
      while a fixture renderer writes to stdout.
- [ ] Implement `src/mcp/` with short modules: framing, JSON-RPC envelope
      validation, session (handshake and capabilities), tool and resource
      registry, typed error mapping, the `CatalogueGateway` interface and its
      loopback implementation, and `src/mcp/README.md`.
- [ ] Implement `get_status`, `search_entries` and `get_entry`, the
      `mokly://catalogue` resource with update notifications driven by
      `/__mokly/events`, and the `mokly://guides/…` resources read from the
      packaged `docs/guides`.
- [ ] Add the `mcp` command: parser entry accepting `--config`, `--port`,
      `--base` and `--debug-timings` and refusing `--watch`, `--no-watch`,
      `--open` and `--out`; `HELP` text; `src/cli/mcp.ts` composing Serve with
      the stderr-bound reporter, the stderr-mapped child factory, no shortcuts,
      bounded readiness waiting and shutdown on stdin end or signals.
- [ ] Add `docs/guides/cli/mcp.md` (order 6) with client configuration
      examples, renumber `options-and-exit-status` to 7 and update its option
      table, and extend `tests/guides_structure.test.ts` and
      `scripts/package/archive.mjs` inventories with the guide and the built
      `dist/mcp` entry.
- [ ] Add a repository `.mcp.json` that runs the built CLI against the example
      catalogue for local dogfooding, and document the required build step.
- [ ] Integration test: fork the built CLI against a fixture, complete the
      handshake, list tools, call `get_status` and `search_entries`, and assert
      stdout contains only JSON-RPC lines.
- [ ] Smoke test: connect Claude Code to `mokly mcp` for the example catalogue
      and exercise the three tools and both resources.

## Milestone 4: Rendering, Changes, comparison and check tools

Complete the tool set over the same gateway.

- [ ] Add failing tests per tool with a fake gateway, plus integration tests
      against a real watched child and Git fixture.
- [ ] `render_view`: resolve the entry, viewport, color scheme and optional
      saved variant to its fragment path, fetch the served document, apply the
      documented size bound with an explicit truncation flag, and return the
      Browse URL for a human to open.
- [ ] `render_component`: send the temporary render POST with exact Host,
      Origin and token headers and one random page id per call; retry once on a
      stale generation after refreshing the capability; map the documented
      HTTP codes to tool errors; return the rendered document, validated props
      and view usage.
- [ ] `list_changes`: project added, changed, removed and unmodified rows from
      the read model including removed entries, per-view comparison
      eligibility and consumers derived from usage records; report pending,
      unavailable and disabled states as such.
- [ ] `compare_view`: request the selected comparison, fetch the before and
      after documents from the immutable generation, return both with a
      line-level unified diff and the change reasons and secondary evidence;
      handle added and removed entries and non-ready states without
      fabricating a comparison.
- [ ] `check_catalogue`: run the CLI `check` for the same config as a captured
      plain-mode subprocess, serialize concurrent calls, enforce a bounded
      timeout, kill the process on cancellation, and return the outcome with
      the error category and message on failure.
- [ ] Close any protocol gaps discovered during implementation in the two MCP
      protocol documents and refresh the README.

## Milestone 5: Verification and delivery

Complete branch work before review; merge remains the completion boundary.

- [ ] Extend the packed-consumer smoke under `scripts/package/` to start
      `mokly mcp` from the installed package, complete the handshake and call
      `get_status`.
- [ ] Run the focused unit and integration tests, the guides and package
      checks, and `cargo xtask check`; resolve failures.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits and push
      the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report numbered,
      severity-rated findings with options and recommendations without
      changing the implementation.

## Post-merge follow-up (non-blocking)

- Optional screenshots through an installed Chrome for multimodal agents,
  without adding a browser dependency to the package.
- A remote MCP endpoint for published catalogues, owned by the cloud
  repository, once the read-model and comment-anchoring work settles.
- Adopt the 2026-07-28 revision (`server/discover`, `subscriptions/listen`,
  `resultType`) when common clients require it; reconsider the SDK if an HTTP
  transport is added.
- Publish the npm release containing `mokly mcp` and confirm the cloud site
  renders the new guide.
