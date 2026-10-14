# Styled Catalogue Link Controls

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Authoring Contract

A link control is one rendered element that Mokly adapts into a catalogue
link while the consumer keeps its component, theme, and styles. It has a React
form and an HTML form under one adaptation contract.

In React, `MockLink` renders an anchor by default. `asChild: true` adapts one
rendered control:

```tsx
<MockLink asChild to="account/overview">
  <Button tone="primary" onPress={noop}>
    Continue
  </Button>
</MockLink>
```

This is composition, not React event forwarding. The consumer owns the
component, theme, and styles. A component that requires an `onPress` to render
enabled still needs that prop; Mokly neither invents a handler nor executes one
in the browser.

Child mode accepts only `asChild`, `to`, `fragment`, and one React element as
`children`; `to` takes the complete path, relative path, or definition
reference forms of the [authoring contract](./mokly-authoring.md#links). Put
classes, styles, ids, accessibility labels, `target`, and other attributes on
that child. Fragments, text, arrays, missing children, and extra wrapper props
fail rather than silently losing props.

In an HTML screen, component, or page body, `to="<path>"` with an optional
`fragment` attribute on a component element, or on a raw `a`, `button`, `div`,
or `span`, makes that element a link control under the
[HTML screens contract](./mokly-html-screens.md#links-and-markers). `to`
takes the complete or relative path form. `to` and `fragment` are reserved on
component elements and never reach props, and a component element's control is
the root element its render produces.

The target and fragment grammars of the
[navigation contract](./mokly-navigation.md) apply in every form. The control
may be one HTML `a`, `button`, `div`, or `span`, with text, icons, and other
non-interactive content. It must be exactly one root element, with no
non-whitespace sibling text. Plain `div` and `span` roots support clickable
rows; their default display is kept when they become anchors. CSS should
target classes or stable attributes; a selector that requires the original
element name does not match an active control after it becomes an anchor.

The root may have no role, `role="button"`, or `role="link"`. Other roles,
unsupported or void roots, an editable root, inline event handlers on the
root, nested link controls, and a malformed control boundary fail the build.
Intended focus attributes belong on the root itself.

### Placement Tiers

Every ancestor and descendant of the control falls into one of three tiers. An
error fails the build. A warning is a
[build warning](./mokly-build-warnings.md): the control still becomes a link
and the bytes are identical to a silent placement. A silent placement produces
no output. Disabled state does not change an element's tier.

| Tier    | Ancestors                                                                                                                                                                                                                                                                               | Reason                                                                                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| error   | `a`, `area`; an editable element                                                                                                                                                                                                                                                        | The parser splits nested links; editable content captures the click                          |
| warning | `button`, `label`, `summary`, `object`; `audio`/`video` with `controls`; a `role` token of `button`, `link`, `checkbox`, `combobox`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `radio`, `searchbox`, `slider`, `spinbutton`, `switch`, `tab`, `textbox`, or `treeitem` | One click or key press has two targets; the role may hide children from assistive technology |
| silent  | `tabindex` of any value, including `-1` on a programmatic focus target; `details` content outside `summary`; a `role` token of `gridcell`, `listbox`, `menu`, `menubar`, `radiogroup`, `tablist`, `tree`, or `treegrid`; every other element                                            | Not a click target                                                                           |

| Tier    | Descendants                                                                                                                                                                                                                       | Reason                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| error   | `a`, `area`, `button`, `input`, `select`, `textarea`, `summary`, `details`, `label`, `iframe`, `object`, `embed`; an editable element; `audio`/`video` with `controls`; the warning-tier ancestor roles; an attribute named `on*` | The nested control can take the click, and a `details` without `summary` renders one; scripts cannot be static |
| warning | `tabindex` of any value; the silent-tier ancestor roles                                                                                                                                                                           | An extra focus stop or structural role inside one link                                                         |
| silent  | Every other element                                                                                                                                                                                                               | Ordinary content                                                                                               |

An element is editable when its `contenteditable` attribute is present with
any value other than `false`. Roles are matched per whitespace-separated
token. An element takes the highest tier reached by any of its features: error,
then warning, then silent. Within that tier, the message shows the first
matching feature in this order: element name, `contenteditable`, `controls`,
`role`, the first `on*` attribute in authored attribute order, then `tabindex`.
For example, `<button tabindex="0">` is an error named as `<button>`,
`<span role="button" onclick="go()">` is an error named with its role, and
`<div role="menu" tabindex="0">` is a warning named with its role.

Checks run in this order: ancestors, the root contract, then descendants.
Ancestors are examined from the control outward. The closest error ancestor
fails the build even when a warning ancestor is closer; without an error, the
closest warning ancestor produces one diagnostic. Descendants are examined in
document order. The first error fails the build even when an earlier warning
was found; without an error, the first warning produces one diagnostic. One
control can therefore produce at most one ancestor and one descendant warning.

Messages describe the classified element as `<tag>` or
`<tag attribute="value">`, where the attribute is the one that decided the
tier: `role`, `contenteditable`, `controls`, or `tabindex`. Displayed authored
values collapse each whitespace run to one space, trim leading and trailing
whitespace, escape `"` as `&quot;`, and render C0/C1 terminal controls as
lowercase `\uXXXX`, so every message stays safe on one line. An `on*`
attribute is shown by name only, never with its value. Errors carry the
`<route>: MockLink child control` prefix; an HTML control produces the same
diagnostics with its file, line, and column under the
[HTML screens diagnostics](./mokly-html-screens.md#diagnostics). Warning
messages omit the route, which the
[build warning record](./mokly-build-warnings.md#record) carries.

```text
MockLink child control is inside <a>; move the control outside it
MockLink child control is inside <div contenteditable="">; move the control outside it
MockLink child control is inside <button>; one click or key press has two targets
MockLink child control contains <input>; remove the nested interactive element
MockLink child control contains <span onclick>; remove the inline event handler
MockLink child control contains <span tabindex="-1">; the link has an extra focus stop
MockLink child control contains <div role="menu">; the role does not belong inside a link
```

A root's own `href` or `data-nav-href` must either be absent or equal the
complete logical destination the control supplies. Conflicting destinations
fail. Native button form attributes are removed during adaptation: a catalogue
link cannot also submit a form. Ordinary unmarked buttons and metadata-only
`data-nav-href` references keep their behaviour.

## Adaptation

Adaptation runs on the composed tree, after the renderer and before
logical-link rewriting, for screen, component, and page documents alike. In an
HTML body the element that carries `to` is the control. In a sidecar render,
`MockLink asChild` wraps the child in a `mokly-link` marker pair under the
markers rule of the [comparison contract](./mokly-comparison.md#markers); the
core reads the pair into the control's region and drops it, so no marker is
served. A pair that consumer output authors, and a malformed, unmatched,
nested, or unconsumed pair, fail the build. Attribute names follow HTML's
case-insensitive parsing rules. Validation reads tree attributes, so a marker
spelling in text, comments, scripts, styles, or unrelated attribute values is
ordinary consumer content.

The `data-mokly-link-control` attribute namespace is reserved throughout the
document. Consumer output cannot supply these attributes, even without link
controls; only the adapter creates them, and a duplicate attribute on an
adapted element fails even where HTML parsing would collapse it. The composed
document keeps the validated control metadata.

An active control becomes one native HTML anchor. Child content, classes,
inline styles, ids, labels, and other applicable attributes stay intact.
Button roles and button-only form attributes are removed. The logical `href`
goes through the target, fragment, viewport, scheme, portable URL, and
Browse-marker rules of the navigation contract and the final checks of
[link validation](./mokly-link-validation.md).

Only a document with an active adapted control receives package-owned CSS, as
one style element in its head. Low-specificity rules restore ordinary
inherited link text styling and the source root's default display (`button`:
inline-block, `div`: block, `span` and `a`: inline). Adapted buttons default
to intrinsic `fit-content` width; authored widths, including full-width block
buttons, take precedence. Consumers that use automatic flex or grid stretching
should state the intended width. Authored CSS and inline styles take
precedence over these defaults. A visible focus outline applies to adapted
links, including controls whose component emits an inline outline reset.
Native browser button chrome and JavaScript-only hover or pressed effects are
not reproduced; use styled static controls. Native links provide keyboard
activation and normal browser link behaviour without a consumer script.

A document without link controls is unchanged by this contract. Serve,
`build`, and both sides of a comparison see the same adapted document, and
adaptation adds no Changes membership of its own.

## Inactive Controls

`disabled`, `aria-disabled="true"`, `aria-busy="true"`, or `inert` on the
control keeps it inactive. An enclosing inert, ARIA-disabled or busy container
or disabled fieldset also keeps it inactive; fieldsets are conservatively
treated as disabled even inside their first legend. Disabled or busy child
props must be reflected in rendered HTML for Mokly to observe them.

Inactive roots keep their element, styling, label, and accessibility state;
their `href` is removed, and a button receives `type="button"` so it cannot
accidentally submit a form when opened directly. The destination stays only
in inert `data-nav-href` metadata for the target and fragment validation. No
activatable Browse marker is produced. Mokly does not override a consumer's
disabled state to make navigation work.

## Integration

The package has no consumer component-library or React Native Web runtime
dependency. A consumer renderer needs no navigation HTML transformer of its
own and keeps theme wrapping and style collection. Verification covers the
default anchor, typed and untyped misuse, the HTML and React forms, native and
custom controls, disabled and busy states, ambiguous and malformed markup,
target validation, light and dark at both viewports, page callbacks and custom
renderers, and browser checks of pointer and keyboard navigation in
script-free Browse and use-case frames, focus visibility, disabled behaviour,
standalone document links, and comparison snapshot links.
