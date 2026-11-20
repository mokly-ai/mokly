# Mockup Source Policy

The authored mockup sources under `docs/mockups/src`, outside `_tests_`, must
render the same bytes on every machine. The
[determinism check](./mockup-verification.md#build-determinism) compares two
builds byte for byte, so it cannot see an input that both builds read alike,
such as the current date. These source rules reject the known machine inputs
before a build runs. The tests hold the accepted and rejected forms of each
rule.

## Drawing Types

A drawing type-checks with React's types and without Node's, so a drawing that
uses a Node global fails. Tests, scripts and configuration keep Node types. A
drawing that does not parse fails.

## Ambient Inputs

- A drawing reads no process, file location, clock, random value or host
  module: `process`, `performance`, `crypto`, `import.meta`, `__dirname`,
  `__filename`, `module` and `require` fail in every value position, also
  through an alias.
- A drawing imports no Node built-in module, with or without the `node:`
  prefix.
- `Date.now`, `Math.random`, a `Date()` call and `new Date()` without a value
  fail. `Date`, `Math`, `Intl`, `globalThis`, `window` and `self` allow only
  direct member access, so an alias cannot hide them.

## Dates, Locales And Time Zones

- A `Date` takes one explicit value. A date string is a compile-time constant,
  and a string with a time ends with `Z` or an explicit UTC offset.
- Local-time getters and setters, `toDateString`, `toTimeString` and the
  default string conversion of a `Date` fail. UTC members, `getTime`,
  `setTime` and `toISOString` pass.
- Every `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` and
  `localeCompare` call, and every `Intl` constructor, names a string-literal
  locale. Date formatting also names a `timeZone`.

The `Date` member and conversion rules apply only to values whose type is
`Date`, so a method with the same name on another object passes. The locale
rule applies to every receiver. Number formatting needs a locale and no time
zone.
