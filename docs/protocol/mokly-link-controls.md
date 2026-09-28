# Styled Catalogue Link Controls

## Delivery Status

Implemented. The Placement Tiers were delivered by the
[styled link control ancestor rule plan](../../plans/styled-link-control-ancestor-rule.md).
The original `MockLink asChild` delivery is recorded in the
[MockLink child controls plan](../../plans/mocklink-child-controls.md).

## Authoring Contract

`MockLink` keeps its existing anchor behavior by default. `asChild: true`
explicitly adapts one rendered control into a catalogue link:

```tsx
<MockLink asChild to="return-overview">
  <Button tone="primary" onPress={noop}>
    Continue
  </Button>
</MockLink>
```

This is static-generation behavior, not React event forwarding. The consumer
still owns the component, theme, and styles. A component that requires an
`onPress` to render enabled still needs that prop; Mokly neither invents a
handler nor executes one in the browser.

Child mode accepts only `asChild`, `to`, `fragment`, and one React element as
`children`. Put classes, styles, ids, accessibility labels, `target`, and other
attributes on that child. Fragments, text, arrays, missing children, and extra
wrapper props fail rather than silently losing props. The existing target and
fragment grammars apply in both modes. A component may render one HTML `a`,
`button`, `div`, or `span`, with text, icons, and other non-interactive content.
It must render exactly one root element, with no non-whitespace sibling text.
Plain `div` and `span` roots support clickable rows; their default display is
retained when they become anchors. CSS should target classes or stable
attributes; selectors that require the original element name no longer match
an active control after it becomes an anchor.

The root may have no role, `role="button"`, or `role="link"`. Other roles,
unsupported/void roots, an editable root, inline event handlers on the root,
nested child-mode links, and malformed marker boundaries fail the build. Inert
template contents cannot contain child-mode markers. Intended focus attributes
belong on the root itself.

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
whitespace, and escape `"` as `&quot;`, so every message remains one line. An
`on*` attribute is shown by name only, never with its value. Errors keep the
existing `<route>: MockLink child control` prefix; warning messages omit the
route, which the [build warning record](./mokly-build-warnings.md#record)
carries.

```text
MockLink child control is inside <a>; move the control outside it
MockLink child control is inside <div contenteditable="">; move the control outside it
MockLink child control is inside <button>; one click or key press has two targets
MockLink child control contains <input>; remove the nested interactive element
MockLink child control contains <span onclick>; remove the inline event handler
MockLink child control contains <span tabindex="-1">; the link has an extra focus stop
MockLink child control contains <div role="menu">; the role does not belong inside a link
```

A root's existing `href` or `data-nav-href` must either be absent or equal the
complete logical destination supplied by `MockLink`. Conflicting destinations
fail. Native button form attributes are removed during adaptation: a catalogue
link cannot also submit a form. Ordinary unmarked buttons and metadata-only
`data-nav-href` references retain their existing behavior.

## Static Generation

The helper emits paired inert template markers around the child. After the
consumer renderer returns, and before logical-link rewriting or compatibility
transformation, Mokly consumes these markers for screen and whole-document
documents. It validates the parsed HTML structure and patches only marked
boundaries and control tags/attributes using their original source offsets.
It does not reserialize the whole document. Markers are an internal reserved
format; malformed, unmatched, nested, or unconsumed markers fail the build.
Attribute names follow HTML's case-insensitive parsing rules. Validation reads
actual attributes, so literal marker names in text, comments, scripts, styles,
or unrelated attribute values remain ordinary consumer content.

The `data-mokly-link-control` attribute namespace, including the stylesheet
marker, is reserved throughout the document and inert template contents.
Consumer renderers cannot supply these attributes, even without child links.
Only the adapter can create them. Duplicate attributes on reserved-metadata
elements fail even when HTML parsing would collapse them. Compatibility output
must preserve their
records: element namespace and tag, control metadata, id, navigation attributes,
and whether the element is inside a template. The package stylesheet's text
must also remain intact. Reordering attributes or independent controls is
allowed; adding, removing, moving metadata to a different logical owner, or
changing owned records fails the build.

An active control becomes one native HTML anchor. Child content, classes,
inline styles, ids, labels, and other applicable attributes remain intact.
Button roles and button-only form attributes are removed. The new logical
`href` goes through the existing target, fragment, viewport, scheme, portable
URL, and authenticated Browse-marker validation. Compatibility transformers
receive the adapted links and must preserve their logical records as usual;
they cannot introduce new unconsumed child markers.

Only documents with active adapted controls receive package-owned inline CSS.
Low-specificity rules restore ordinary inherited link text styling and the
source root's default display (`button`: inline-block, `div`: block,
`span`/`a`: inline). Adapted buttons default to intrinsic `fit-content` width;
authored widths, including full-width block buttons, take precedence. Consumers
using automatic flex/grid stretching should specify the intended width.
Authored CSS and inline styles take precedence over these defaults. A visible
focus outline applies to adapted links, including controls whose component
emits an inline outline reset. Native browser button chrome and JavaScript-only
hover/pressed effects are not reproduced; consumers should use styled static
controls. Native links provide keyboard activation and normal browser link
behavior without adding a consumer script.

Documents without child-mode markers retain identical bytes. Adding this API
does not rewrite existing catalogues or change the Changed filter's semantics.

## Inactive Controls

`disabled`, `aria-disabled="true"`, `aria-busy="true"`, or `inert` on the
control keeps it inactive. An enclosing inert, ARIA-disabled/busy container or
disabled fieldset also keeps it inactive; fieldsets are conservatively treated
as disabled even inside their first legend. Disabled/busy child props must be
reflected in rendered HTML for Mokly to observe them.

Inactive roots retain their element, styling, label, and accessibility state;
their `href` is removed, and a button receives `type="button"` so it cannot
accidentally submit a form when opened directly. The destination remains only
in inert `data-nav-href` metadata for the existing target/fragment validation.
No activatable Browse marker is produced. Mokly does not override a
consumer's disabled state to make navigation work.

## Integration And Verification

The package has no consumer component-library or React Native Web runtime
dependency. A consumer renderer can drop its custom navigation HTML transformer
after adopting this API while retaining theme wrapping and style collection.
This package change does not migrate or publish downstream repositories.

Verification covers default-anchor byte compatibility, typed and untyped API
misuse, source-byte preservation, native/custom controls, disabled and busy
states, ambiguity and malformed markup, target validation, light/dark and both
viewports, page callbacks/custom renderers, compatibility transforms, and clean packed
ESM/NodeNext consumers. Browser checks exercise real Firna buttons, pointer and
keyboard navigation in script-free Browse/use-case frames, focus visibility,
disabled behavior, standalone file links, and Review snapshot links.
