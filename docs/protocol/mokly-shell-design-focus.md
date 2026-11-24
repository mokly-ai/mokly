# Shell Focus Design

This continues the [shell design contract](./mokly-shell-design.md). It fixes
how the shell shows keyboard focus.

## Focus

Keyboard focus shows the `@firna/ui` focus glow, not an outline: a 4px halo
with no blur, in the shell accent at 75%. The accent defaults to `signalDeep`,
and a host tunes it with `--mokly-accent`. The glow keeps 3:1 against each
surface that it draws on, in both schemes, also with a host's accent. A control
draws the glow outside its box, over its own shadow. A row, a segment, a tab
and a control at the edge of a panel that clips or scrolls draw it inside the
box. A drawn control under a transparent native control, such as the
Appearance select, shows the glow. The split separators keep their accent grip,
as the [navigation design](./mokly-shell-design-navigation.md#catalogue-panel)
says. Forced-colors mode drops shadows, so there focus takes a 2px `Highlight`
outline. Decision 38: the viewer takes the focus design of the site and the
cloud app, so that focus looks the same on every surface, and the 2px outline
with a 2px offset was rejected.
