# Product Mockups: Mac App

This inventory is part of [Product mockups](./product-mockups.md).
Its paths match the current source and generated catalogue.

## Mac App

The Mac app's window has no title bar, as
[Desktop bundle and origin](./desktop-bundle.md#mac-window) requires. macOS
draws the window buttons over the start of the window, centred in the 48px top
bar, and every top bar starts its content after them. Three drawings show the
space that the buttons take, one for each composition of a top bar. Every
other screen with a top bar uses one of these compositions.

| Path                                | Owner screen                | Draws                                                                                    |
| ----------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| `product/viewer/standalone/mac-app` | `product/viewer/standalone` | The ready viewer; the cloud's slot content starts after the buttons                      |
| `product/account/sign-in/mac-app`   | `product/account/sign-in`   | Sign in; the buttons sit over the empty start of the account header                      |
| `product/settings/sections/mac-app` | `product/settings/sections` | Settings; the buttons stay above the dialog's backdrop, and the compact bar starts after |

The viewer and sign-in drawings are screens beside their owners. The
settings drawing is a variant of its owner, after its three states. Each
drawing links to the other two below its screen.

The desktop view of each drawing is a wide window. The mobile view is a narrow
window, because the window can be narrower than the breakpoint and then shows
the compact composition. The narrow window's compact settings bar is 48px
high, as every top bar is, so the buttons line up with its controls. A phone
keeps its taller bar. A screen with no top bar, such as Not found, gets an
empty 48px band at its top that moves the window, and its content starts below
the band. A window in full screen looks the same as in a browser. Neither has
a drawing.

The registered `design/window-controls` illustration draws the buttons. It is
decorative, hidden from assistive technology, and coloured with the window
button tokens of [Design tokens: colour](./design-tokens-color.md).
