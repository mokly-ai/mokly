# Viewer Chrome: Check Slot

Status: The check card's moved line is not built yet. The [check card's moved line item](../../../plans/follow-ups/check-card-moved-line.md) builds it.

This is the check sub-contract of [Viewer chrome](./viewer-chrome.md#slot-inventory).

## Check Slot

The package's Changes tab holds one host slot, `changesStart`, between the
change stepper and Compared, as [Changes screen
controls](../mokly-changes-controls.md#changes-tab) defines, and shows it only
on a changed entry. Cloud fills it with the check card of a pull request's
publication: the Mokly check that [Changes check](./changes-check.md#result)
posts for that publication. A branch's publication leaves the slot empty. The
card shows the success glyph, the check's name, Mokly, and the count lines of
the check's summary, without its View Changes link, because the reader is
already in Changes. Its foot links the pull request's checks on GitHub with the
number and title, and carries the external glyph, because it leaves the app; the
bar already links the pull request itself. The card's composition is in [Viewer
compositions](./folio-viewer.md#compositions). Decision: the check fills a host
slot inside the package's Changes tab, not a cloud panel in `sidePanel`, because
a cloud panel beside the package's Changes would copy it, and the cloud never
reimplements Browse or Changes.
