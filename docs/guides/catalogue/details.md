---
title: "Details"
description: "The evidence behind a screen, beside the screen."
section: "catalogue"
order: 4
---

## Open the inspector

The details inspector sits beside the screen. It starts collapsed and keeps
that choice across routes and reloads, so the catalogue opens the way you left
it.

## What it holds

- The entry's id, title and description.
- The tags it carries, as chips you can search from.
- The related documents it names, without a source-path dependency list.
- Its components, and for a component page the screens that use it.
- The changed paths behind its status, including comparison evidence for an
  unchanged screen opened from All.

Catalogue-wide usage is explicitly unavailable until the background check has
finished; it is never shown as zero consumers.

## Stylesheet evidence

When a stylesheet you link has changed, the inspector names the changed styles
that apply to this screen outside the components changed by those styles,
or says the change can apply anywhere on it.
A stylesheet whose changed styles reach nothing on the screen is listed as
examined and excluded instead, and never produces a Changes row. Selector text
stays inside that secondary list, and a screen kept only by a stylesheet edit
reads "Styles this screen uses changed" above its comparison.

The inspector shows this evidence before you open a comparison, for screens
and component pages alike. Opening one keeps those details and adds the
evidence it retained. Each stylesheet is listed once, with its own sentences
and selector lists beneath it. For outside matches, the text says “These
changed styles also apply outside the changed components on this screen:”. If
no component changed through those rules, it says “Changed styles that apply
to this screen:”. A rule inside an unchanged component invocation can appear
in that list. Uncertain changes have a separate explanation beside it.

A component-only style change can leave a screen under Affected screens with
no Changes row of its own. That screen keeps the changed styles it uses. On the
component's own page the details say “Changed styles that apply to this
component:”. A component page with only a wrapper change has its own
saved-view row, says “Changed styles that apply to this saved view:”, and that
rule gives it no Affected screens. The details name the stylesheet actually
loaded, including a generated stylesheet when CSS comes from JavaScript.
Private source files do not supply comparison evidence.

## Component props

On a component page the inspector shows the component's variant entries and
declared controls. While serving locally you can edit text, boolean, number and
preset controls and see the result immediately; Reset restores the current
variant's declared props. A published catalogue keeps the variants and the
inspection with the controls read only.
