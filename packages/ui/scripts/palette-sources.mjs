/**
 * The value sources of the palette role tables. A source reads one scheme of
 * a palette, `{ appearance, colors, fonts }`, and returns the value of one
 * appearance. Mixes are computed here in sRGB, as `color-mix(in srgb, …)`
 * mixes, and written as values: an opaque mix as `#rrggbb` with each channel
 * rounded, a translucent colour as `rgba()`.
 */

/** `#rrggbb` as its red, green and blue channels. */
function channels(color) {
  if (!/^#[0-9a-f]{6}$/u.test(color))
    throw new Error(`[palette] ${color} is not an opaque #rrggbb colour`);
  return [1, 3, 5].map((start) =>
    Number.parseInt(color.slice(start, start + 2), 16),
  );
}

/** Two opaque colours mixed in sRGB: `percent` of the front over the back. */
function mixed(front, percent, back) {
  const behind = channels(back);
  const mix = channels(front).map((value, index) =>
    Math.round((value * percent + behind[index] * (100 - percent)) / 100),
  );
  return `#${mix.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** An opaque colour at an opacity, as a mix with `transparent` gives it. */
function translucent(color, opacity) {
  return `rgba(${channels(color).join(", ")}, ${opacity})`;
}

/** The colour of shadows and scrims: `text` in Light, `background` in Dark. */
function shade({ appearance, colors }) {
  return appearance === "light" ? colors.text : colors.background;
}

/** A Canvas colour role. */
export function canvas(role) {
  return ({ colors }) => colors[role];
}

/** One part of a person's colour on a shared canvas: its `fill` or `ink`. */
export function person(name, part) {
  return ({ colors }) => colors.people[name][part];
}

/** A Canvas role mixed over another, with the front role at `percent`. */
export function mix(front, percent, back) {
  return ({ colors }) => mixed(colors[front], percent, colors[back]);
}

/** A Canvas role at an opacity. */
export function tint(role, opacity) {
  return ({ colors }) => translucent(colors[role], opacity);
}

/** The shade at an opacity. */
export function shaded(opacity) {
  return (scheme) => translucent(shade(scheme), opacity);
}

/** A shadow layer: its offsets, blur and spread, in the shade at an opacity. */
export function layer(geometry, opacity) {
  return (scheme) => `${geometry} ${translucent(shade(scheme), opacity)}`;
}

/** The 1px ring that a Dark shadow adds, in `text` at an opacity. */
export function ring(opacity) {
  return ({ colors }) => `0 0 0 1px ${translucent(colors.text, opacity)}`;
}

/** The layers of a shadow, one list for each appearance. */
export function shadow(light, dark) {
  return (scheme) =>
    (scheme.appearance === "light" ? light : dark)
      .map((part) => part(scheme))
      .join(", ");
}

/** A value without a Canvas source, one for each appearance. */
export function fixed(light, dark) {
  return ({ appearance }) => (appearance === "light" ? light : dark);
}

/** A font stack of the palette. */
export function font(stack) {
  return ({ fonts }) => fonts[stack];
}

/** A value that no palette changes. */
export function literal(value) {
  return () => value;
}

/** A role that each appearance declares with its own value. */
export function themed(property, source) {
  return { property, source, shared: false };
}

/** A role that the Light block declares once for both appearances. */
export function shared(property, source) {
  return { property, source, shared: true };
}

/** One scheme of a palette, as the sources read it. */
export function scheme(palette, appearance) {
  return { appearance, colors: palette[appearance], fonts: palette.fonts };
}

/**
 * The declarations of one appearance, as `[property, value]` pairs: every
 * role in Light, and the themed roles in Dark.
 */
export function declarations(roles, scheme) {
  return roles
    .filter((role) => scheme.appearance === "light" || !role.shared)
    .map(({ property, source }) => [property, source(scheme)]);
}
