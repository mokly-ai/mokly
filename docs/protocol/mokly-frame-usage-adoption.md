# Frame usage adoption

This is the focused evidence-update contract for the
[frame adapter](./mokly-frame-adapter.md).

## Initialization handoff

A mounted frame cannot become inspection-ready with usage that its adapter
has not adopted. Initial synchronization and the end of initialization form
one synchronous boundary. Evidence arriving in the following microtask must
use the normal ordered update path and its replacement readiness promise.
The initial readiness continuation must not skip that update. This rule also
applies when an initially unavailable or pending view receives ready usage.

## Updates and inspection

Both built-in adapters implement optional `updateUsage` for validated evidence
on the same document. It clears that frame's old inspection presentation,
replaces the usage snapshot and updates its existing event subscription. A
pending/unavailable-to-ready update enables hover/click inspection without a
document load or new session; the reverse transition disables it while preserving
navigation. The viewer's frame update path uses this capability for unchanged
URL/viewport/scheme/step identities; custom adapters that omit it retain
replacement-mount behavior for changed usage. Updates reject after disposal and
their failures retain session cancellation ownership. This is a host-side method;
the existing wire `subscribe` event set, schemas and inspector script are unchanged.

The viewer's inspection owner handles each changed usage snapshot before its
asynchronous adoption. It invalidates old inspection work, then restores valid
masks, outlines and host labels after the selected sessions finish updating.
Public highlights remain confined to their referenced frame, including when a
sibling is pending or updates independently. Every previously referenced key
must remain in ready usage; otherwise clear all current presentation and end an
active pick once with the viewer's `evidence` reason. Pending pick activation is
cancelled with `disposed` and no start/end event; a fresh activation waits for
the updated sessions. Unrelated updates do not cancel or redraw inspection.
Updates are ordered per session; superseded success/failure has no current host
effects. This coordination belongs to the viewer, not the inspector protocol.
