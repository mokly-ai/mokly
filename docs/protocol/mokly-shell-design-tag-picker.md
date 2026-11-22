# Shell Tag Picker Design

This continues the [shell design contract](./mokly-shell-design.md#layout). It
fixes the tag picker of the top bar's search field.

## Control And Panel

The tag picker is a tag-icon control at the trailing edge of the search field,
muted like the leading search icon and filling to a soft rounded square on
hover. It opens a panel anchored under the field and aligned to its width: a
`--chrome-surface` card with a hairline border, 10px radius, and
`--chrome-shadow` elevation, holding an uppercase 11px muted `Tags` head above
a wrapping row of the Details Tags row's chips. The panel lists every tag the
catalogue declares, in alphabetical order, and scrolls internally once that set
outgrows it. A catalogue that declares no tags renders neither the control nor
the panel. Below the layout breakpoint the panel drops as a sheet under the
bar, as the [compact layout](./mokly-shell-device-chrome.md#compact-layout)
says.

## Chips

Selecting a chip enters `tag:<tag>` in the search field, replacing any tag term
already entered, and closes the panel; selecting the chip whose tag is the
entered term clears that term. The chip matching the entered query carries the
accent active state with contrast text and glyph. A tag chip is a button on
both surfaces: it reports whether its tag is entered through `aria-pressed`,
fills with the soft accent on hover, and moves down 1px with an inset shadow
while pressed.

## Focus And Keys

Opening the panel moves focus to the chip for the entered tag, or to the first
chip when no tag is entered; the chip row then keeps a single tab stop that
ArrowLeft and ArrowRight rove and wrap at both ends, Home and End send to its
ends, and Enter or Space activates. The row is a labelled toolbar with one tab
stop. Details chips keep independent tab stops. Escape closes the panel and
returns focus to the control without changing the query. An outside click
closes it and returns focus only if the panel held focus. Selecting a Details
tag closes an open picker and focuses its toggle.

## Related Docs

- [Shell design contract](./mokly-shell-design.md), with the top bar's search
  field and the Details Tags row
- [Shell canvas frames, preview scheme and compact layout](./mokly-shell-device-chrome.md)
- [Shell navigation design](./mokly-shell-design-navigation.md)
