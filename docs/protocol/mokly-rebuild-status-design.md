# Rebuild Status Design

## Delivery Status

Approved target for Milestone 2 of the
[Serve rebuild status plan](../../plans/serve-rebuild-status.md). The mockup
milestone must add these states before shell implementation begins and record
its final progress placement here. The behavioral source is the
[rebuild status contract](./mokly-rebuild-status.md).

## Placement And Ownership

The failure notice is package-owned shell chrome, full width immediately below
the 48px top bar and before `.mbk-body`. It appears in the same place on home,
screen, component, page, flow, comparison, removed, and missing routes. It is
outside preview frames, so Static and Live use the same notice. Compact and
wide shells keep the same information and order; compact presentation may wrap
but may not hide or abbreviate the copy.

The notice is one full-surface treatment with an icon, background, padding, and
a complete perimeter or tonal edge treatment. It must never use a contrasting
left-edge border, inset stripe, pseudo-element, gradient edge, shadow rail, or
adjacent vertical bar. Color is not its only failure cue. It reuses the shell's
semantic palette, type, focus, disclosure, spacing, and icon conventions rather
than introducing environment or developer-tool styling.

## Required Screen States

The screen-spec page contains exactly these five standalone screen components,
each with separate mobile and desktop variants:

| State                  | Required depiction                                                         |
| ---------------------- | -------------------------------------------------------------------------- |
| Failure                | A Static screen with the notice and collapsed disclosure; no progress      |
| Failure details        | The same screen with the real text detail disclosed                        |
| Updating               | A screen with delayed progress visible and no failure notice               |
| Failure and updating   | The failure remains visible while delayed progress is also visible         |
| Live component failure | A component saved variant with Live selected and the same collapsed notice |

The first Failure screen is the canonical representation. The page must be
reachable from the design catalogue navigation and link its owning child
states in the usual screen-spec hierarchy. These are shell states, not a user
flow; none may invent a screen inline. Existing shell, top-bar, workspace,
device, preview-mode, artboard, and inspector components must be reused.

The Static and Live examples must differ only in their existing workspace
state. The notice cannot enter the device frame, cover its content, replace an
interactive-preview failure, or add a mode badge. The details mockup uses one
bounded, sanitized repository-relative fixture diagnostic; it must not use an
absolute path, ANSI styling, HTML, or explanatory implementation annotations.

## Product Copy

Use this copy in the initial mockups:

- headline: **Your latest changes couldn't be loaded.**
- explanation: **You're seeing the last working version.**
- collapsed disclosure: **Show details**
- expanded disclosure: **Hide details**
- progress: **Updating…**

Milestone 2 may refine these words only if it records the approved replacement
here before implementation. Headline and explanation never mention builds,
bundles, generations, watch actions, schemas, file formats, or environment
names. The disclosed diagnostic is secondary developer detail and is never
promoted into the headline, explanation, navigation, or progress copy.

## Progress Placement Constraint

Progress appears only after the contract's 1,000 ms delay. Showing or hiding it
must not change top-bar height, notice height, `.mbk-body` position, stage size,
navigation height, or scroll position at either width. The mockup milestone
must choose one exact placement, record its dimensions here, and demonstrate it
both with and without the notice.

When progress is hidden, it must leave no visible empty placeholder at either
width. Acceptable directions are a slot inside already occupied, flexible
top-bar or notice space, or a non-obscuring overlay anchored to shell chrome
that covers no control or content. Inserting a row after the delay, moving the
notice away from directly below the top bar, covering content, relying on a
width-specific placement, or creating an idle gap is not acceptable.

## Interaction And Accessibility

The notice is a labelled region with a real heading; its decorative icon is
hidden from assistive technology. It is not itself an assertive alert. The
existing polite, atomic `#mb-status` region owns the once-per-failure live
announcement defined by the behavioral contract. Initial server-rendered
failure content remains ordinary discoverable document content, which avoids
announcing it again on reload.

The disclosure is a native details/summary interaction or a button with
`aria-expanded` and `aria-controls`. Its visible label reflects open state,
works by keyboard, retains visible focus, and never moves focus when the
failure changes. Detail text is selectable, wraps long tokens, preserves line
breaks, and cannot create horizontal page scrolling.

Progress always has the visible text “Updating…”; a spinner or other motion is
supplementary and hidden from assistive technology. Under
`prefers-reduced-motion: reduce`, remove rotation, pulsing, sweeping, and
animated transitions while retaining the same reserved geometry, text, and
contrast. Failure, disclosure, and progress must remain understandable at
200% zoom and without color.

## Verification

Milestone 2 must build and inspect all ten viewport variants. Design tests pin
the five states, copy, notice/detail/progress presence, Static and Live modes,
disclosure state, full-width placement, navigation reachability, reused screen
components, and the absence of any left accent rail. A layout assertion must
show identical content geometry immediately before and after progress appears.
Keyboard, focus, reduced-motion, long-detail wrapping, and contrast checks are
required before the selected placement is recorded as final.

## Related Docs

- [Watched Serve rebuild status](./mokly-rebuild-status.md)
- [Shell design](./mokly-shell-design.md)
- [Interactive views design](./mokly-interactive-views-design.md)
- [Component workspace design](./mokly-component-workspace-design.md)
