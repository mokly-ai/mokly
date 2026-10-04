# Watched Serve Rebuild Status

## Delivery Status

Implemented for watched Serve: the parent publishes private status and the
shell presents it. This document owns the status model, action lifecycle,
sanitizing, and shell behavior. The
[transport contract](./mokly-rebuild-status-transport.md) owns IPC, descriptor,
events, and adoption; the [design contract](./mokly-rebuild-status-design.md)
owns presentation.

## Boundary And Model

Rebuild status exists only in watched `mokly serve`. It is independent of the
`interactive` setting. Unwatched Serve, Build, Check, export, publication,
static workspace evidence, generated files, public catalogue JSON, the public
shell bootstrap, and application-owned embedded viewers never contain it.

Every payload is a complete snapshot with exactly this shape:

```ts
interface RebuildStatus {
  failure: null | {
    detail: string;
    id: number;
  };
  sequence: number;
  updateVersion: number;
  updating: boolean;
}
```

`sequence`, `updateVersion`, and `failure.id` are positive safe integers.
Objects admit no extra keys. The watched parent starts `sequence` at 1 with
`{ updating: false, failure: null }` and increments it for every distinct
published snapshot; it never wraps. A duplicate snapshot is not published.
`failure.id` is the `sequence` that created that failure, remains unchanged
while progress changes around it, and is at most the enclosing `sequence`.
The two facts are independent: `updating: true` may accompany either value of
`failure`.

`updateVersion` is a minimum-adoption fence, not another status sequence. A
page may adopt the snapshot only after its private capability source has an
update version greater than or equal to that value. The parent owns both
counters. Exhausting either safe-integer range is a fatal watched-Serve fault;
counters never reset while that parent remains running.

## Watch Action Lifecycle

The status starts idle and successful on initial readiness. Initial catalogue
preparation happens before a browser can connect and does not show progress.
After the watch debouncer chooses an action, the serialized queue applies these
rules:

| Selected action | Shows progress | Source failure sets `failure` | Delivery failure sets `failure` | Adopted source clears it |
| --------------- | -------------- | ----------------------------- | ------------------------------- | ------------------------ |
| `reconfigure`   | yes            | yes                           | no                              | yes                      |
| `rebuild`       | yes            | yes                           | no                              | yes                      |
| `restart`       | yes            | n/a                           | no                              | no                       |
| `reload`        | yes            | n/a                           | no                              | no                       |
| `evidence`      | no             | n/a                           | no                              | no                       |
| `ignore`        | no             | n/a                           | no                              | no                       |

Progress begins when a qualifying action enters the action queue, including a
manual rebuild or recovery restart, and covers all time queued and running. It
does not begin during the filesystem debounce interval, when no winning action
exists yet. If the debouncer subsumes several notifications, only its
highest-priority selected action applies. If the action queue subsumes pending
actions, progress begins with the first qualifying enqueue and stays true
without a false transition while any qualifying action remains queued or
running. A following evidence-only action does not extend it.

A rebuild or reconfigure action has two explicit typed phases. Its source phase
includes configuration loading, graph construction, registry and index
validation, candidate watcher readiness, background invalidation, and every
other operation before the new runtime is adopted. Adoption updates the
parent's active configuration and runtime and stages or installs that runtime
for the child. It ends the source phase and immediately clears the failure with
the accepted runtime's reserved update version.

Everything after adoption is the delivery phase. This includes replacing or
closing watchers and updating, restarting, or recovering the HTTP child. A
source-phase error replaces `failure`, because the latest authored source was
not accepted and is not what the browser shows. A delivery-phase error never
sets or replaces `failure`: the accepted success stays clear even if the first
child restart fails, recovery also fails, or closing an old watcher fails. The
delivery error is still reported once through the existing terminal watch
failure path.

A rebuild that discovers changed watch targets and executes reconfiguration is
still one source-update action and uses the same boundary: failures before the
reconfigured runtime is adopted are source failures, while failures afterward
are delivery failures. Shutdown cancellation creates no failure. Failures from
`reload`, `restart`, unexpected-child recovery, evidence refresh, or background
Changes/render completion retain the existing failure and keep their current
terminal or Changes reporting. A quick accepted source runtime therefore counts
as a successful rebuild even if later delivery or background Changes work
becomes unavailable.

Starting another action while a failure is shown retains the notice and its
id. After the progress delay, both are visible. An adopted rebuild or
reconfigure clears the failure with its accepted content update. A source-phase
failure atomically installs a newly sanitized detail and new id; a delivery
failure leaves the accepted clear state in place. Reload and restart completion
only ends progress. When another qualifying action is already pending, the
terminal snapshot retains `updating: true`.

## Sanitized Failure Detail

The raw input is the caught value's message (`Error.message`, otherwise its
string coercion), never a stack. The parent applies these steps in order:

1. Strip complete ANSI/ECMA-48 escape sequences, including CSI. Recognize
   seven-bit `ESC ]`, `ESC P`, `ESC X`, `ESC ^`, `ESC _` and eight-bit
   U+009D, U+0090, U+0098, U+009E, U+009F as OSC, DCS, SOS, PM and APC
   string introducers, respectively. Remove each string with its payload
   through the first BEL, seven-bit `ESC \`, or eight-bit String Terminator
   U+009C, including that terminator. For an unterminated string, remove the
   introducer and every remaining character through the end of the message.
   OSC hyperlinks keep only the visible text outside those strings.
2. Normalize CRLF and CR to LF, replace each tab with two spaces, replace
   unpaired UTF-16 surrogates with U+FFFD, and remove every remaining C0/C1
   control plus DEL except LF.
3. Treat an unprefixed POSIX token as a path only when it has at least two
   non-empty segments (for example `/tmp/x`); `/`, closing-tag/operator syntax,
   and a one-segment token such as `/tmp` remain unchanged. Rewrite qualifying
   POSIX, Windows drive, UNC, and `file:` paths that resolve to `repoRoot` or a
   descendant as `.` or a repository-relative POSIX path. Preserve any trailing
   `:line[:column]` location. Replace every other absolute filesystem path with
   the literal `<absolute path>`. HTTP(S) URLs are not filesystem paths and
   remain unchanged.
4. Trim surrounding whitespace. If nothing remains, use
   `No additional details are available.`
5. Limit the result to 2,048 Unicode scalar values and 8,192 UTF-8 bytes. If
   either limit truncates it, trim trailing whitespace from the fitting prefix
   and append U+2026, with the ellipsis included in both limits. Never split a
   scalar value or UTF-8 sequence.

The post-sanitizing value must be nonempty and within both limits before it can
cross IPC. The disclosure renders it as a text node with preserved line breaks;
it never uses HTML injection, Markdown, linkification, or terminal styling.

## Transport And Adoption

Parent-to-child IPC, initial transfer, update-version staging, private
descriptor and SSE shapes, replay, and browser ordering follow the
[rebuild status transport contract](./mokly-rebuild-status-transport.md).

## Shell Behavior And Accessibility

The shell reads only `useViewerLiveState().rebuildStatus`. A failure notice is
shell chrome on every route, outside Static and Live frames. Its initial
descriptor value is visible during server rendering and hydration. A mounted
document announces the headline and explanation through the existing polite,
atomic `#mb-status` region once when it adopts a new `failure.id`; progress or
replay of that id does not announce it again. A failure already present at
first paint is the accessible document baseline, not a live change, so reloads
and newly opened tabs do not reannounce it. Each announcement replaces the
region's text node, so a later failure is spoken even when the words repeat;
a cleared failure withdraws its text unless a newer message replaced it.
Focus never moves to the notice when a failure appears, changes, or clears.

Progress becomes visible exactly 1,000 ms after that client first observes one
uninterrupted `updating: true` interval. A transition to false before the timer
fires cancels it, so fast updates never flash. A newer true snapshot does not
restart the timer. Initial hydration starts the same timer. While hidden, the
progress area leaves no visible empty placeholder at either width: reserved
geometry must live inside already occupied, flexible shell chrome, or use a
non-obscuring overlay that covers no control or content. Reduced-motion styling
removes nonessential animation without removing the text.

The [design contract](./mokly-rebuild-status-design.md) fixes the notice,
disclosure, copy, responsive states, and prohibition on a left-edge accent
rail. Opening details is local shell state. It stays open while the same
failure id remains, closes when that failure is replaced or cleared, is not
part of reload recovery, and never changes the server status. A replacement
closes the same native disclosure in place: focus on its control stays there,
and focus inside the closing detail returns to that control instead of being
lost. The disclosed detail is a keyboard-focusable region named "Error
details", so it can be reached and scrolled without a pointer.

## Failure Handling And Verification

- EventSource loss leaves the descriptor state visible and reports the existing
  optional-transport warning; a later connection replays current state.
- If no child is ready, the parent still advances and retains status. The next
  child receives only the latest snapshot before readiness.
- A lazy Live bundle failure, including a missing generation capture, uses the
  existing Live-unavailable state and never becomes a rebuild failure.
- Status never changes the terminal diagnostic, last-good catalogue, Changes
  state, update recovery, or public catalogue revision semantics.

Verification covers the complete action matrix, debounce/queue coalescing,
continuous queued progress, retry-while-failed behavior, sanitizing and both
bounds, strict envelopes, staged clears, child restart retention,
descriptor/event validation, replay and stale ordering, and absence from every
excluded boundary. Terminal-string tests combine every seven-bit and eight-bit
OSC, DCS, SOS, PM and APC introducer with BEL and both String Terminators,
including unterminated strings and file hyperlinks.
Browser coverage uses real watched Serve for first paint,
multiple tabs, reconnection, once-per-id announcements, the 1,000 ms threshold,
Static/Live, and every route at both widths. Smoke coverage exercises source,
configuration, and resource failure and recovery.

## Related Docs

- [Watched development](./mokly-watch.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Interactive Serve delivery](./mokly-interactive-views-serve.md)
- [Viewer contract](./mokly-viewer.md)
- [Shell design](./mokly-shell-design.md)
