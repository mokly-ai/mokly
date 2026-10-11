# Product UI

Rules for user-facing screens, mockups, and copy: where screens live, how to
reuse components, which visual patterns are forbidden, and how data and copy
must behave.

- Native product screens, logged-in web product screens, and logged-out web
  marketing routes all belong in the Expo app under `ts/app`; marketing routes
  must stay hidden from native mobile navigation.
- When implementing UI under `ts/app`, always check the available reusable/base
  components in `ts/app/src/components` first and use them where possible. If a
  component or pattern is used many times across the app, extract it or add it
  to `ts/app/src/components` instead of duplicating the implementation.
- Product UI and mockups must never use a left-edge accent border or vertical
  accent rail to emphasize, select, categorize, decorate, or communicate the
  status of content. This prohibited pattern includes a contrasting stroke
  attached to the left side of a card, panel, callout, banner, list row,
  navigation item, or other content surface, including strokes with rounded
  ends or corners. Do not recreate the pattern with a pseudo-element, inset
  shadow, gradient, outline, or separate adjacent bar; use the established
  component system's typography, spacing, icons, full-surface treatments, or
  standard selection controls instead.
- Normal product views must not expose sandbox, test, or preview environment
  labels, badges, or explanatory copy in the implementation. The same view
  should render across environments, with environment-specific data selected
  from the URL or environment configuration.
- Data displayed to the user MUST never be faked, stubbed, hardcoded, or mocked
  in product code. Every value shown in a view must come from a real data
  source (API, database, store, or live computation). Do not ship placeholder
  numbers, dummy rows, lorem-ipsum content, or "TODO: wire up real data"
  values in screens users can reach. If the real source is not available yet,
  render an explicit empty, loading, or error state instead of inventing data,
  and wire the view to the real source before the feature is considered
  complete. Faked or stubbed data is only acceptable in tests, mocks,
  fixtures, and mockups under `docs/mockups`.
- User-facing copy must read as product language written for the user, not
  engineer-facing build or status output. Lead with the outcome or action the
  user cares about, keep it plain and professional, and never leak internal
  implementation detail into text users read — validation-artefact, schema, or
  pipeline names (for example RIM, XSD, Schematron), internal flags, message
  classes, file formats, environment names, or code identifiers. When such
  technical detail has genuine product value, surface it in a clearly secondary
  place (a details or profile panel), not in the headline copy. This applies to
  both mockups under `docs/mockups` and product implementation (`ts/app` and
  other user-facing surfaces).
