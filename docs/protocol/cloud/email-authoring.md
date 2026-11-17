# Email Authoring And Checks

This is the authoring and verification contract for [Email](./email.md).

## Source And Generation

One source in the mockup catalogue owns every email: the typed content shape
with its placeholder names and formatted lifetime, the style table per scheme
and viewport with the two override groups derived from it, the shared body
and the delivered shell around it, and one definition per kind that exports
the subject, preheader, text body and body. That source imports only React,
the tokens package and its own siblings — never the control library, React
Native, catalogue components or fixtures — so the generator runs without the
React Native Web loader and a catalogue change cannot leak into a delivered
message. The [mockups README](../../mockups/README.md#key-code) names the files.

The catalogue screens compose the body with fixture content and the
catalogue's own copies of the two logos, which are byte-identical to the
published lockups under `apps/site/public/brand/`. The generator composes the
delivered document with placeholder content whose every value is the
`{{name}}` token itself and `{{siteOrigin}}/brand/` as the brand root. It
keeps escaped `{{name}}` substitutions in HTML and writes unescaped
`{{{name}}}` substitutions in the subject and plain text, because Postmark's
[Mustachio syntax](https://postmarkapp.com/support/article/1077-template-syntax)
HTML-encodes ordinary substitutions and that encoding would expose entities
in names and links outside HTML.

`npm run emails:build` writes six files into the directory given by `--out`
(default `crates/mkc-email-templates/templates`), each ending in a newline:

| File                 | Contents                        |
| -------------------- | ------------------------------- |
| `<kind>.subject.txt` | The subject line                |
| `<kind>.txt`         | The plain-text body             |
| `<kind>.html`        | The complete delivered document |

`<kind>` is `sign-in` or `invitation`. The committed copies live in
`crates/mkc-email-templates/templates/` and are excluded from Prettier as
generated output. `cargo xtask email-templates` regenerates them in place;
`cargo xtask email-templates --check`, verification stage 19 in
[Repository verification](./repository-verification.md#verification-cargo-xtask-check),
runs the generator in check mode and rejects a missing, extra or byte-different
file, naming the regeneration command. Trusted deployment jobs
[compare these files with Postmark](./email-postmark-sync.md) on every stable
promotion and upload only changed templates.

## Catalogue And Checks

The `Design › Email` folder owns `design/email/sign-in` and
`design/email/invitation`, tagged `email` and `folio`, drawn in both viewports
and schemes from one named component each, with `data-mkc-screen` on the root.
The mockups build writes their documents at
`static/mokly-generated/design/email/<kind>/index.<viewport>[.dark].html` in
its `mokly-static/` output. They are not product
inventory screens and have no empty, loading or error state: a delivered
document has one state. The sign-in email is a step of
`flows/product-onboarding` between the magic-link screen and connecting
GitHub; `flows/product-invitation` runs `product/settings/members`,
`design/email/invitation`, `product/account/sign-in`,
`product/account/invitation-accept`. An email document links only the base
stylesheet and the email frame stylesheet, because the email depends on
nothing linked and the frame needs only the canvas and the inbox lines.

The catalogue's policy tests and browser checks hold the rules of
[Email](./email.md): every color a rendered subtree carries is one of the
five named Folio roles, one of the three shared accent roles, or
transparency; the subtree loads no resource but the two logos; the action
cell alone carries the accent; the generated document equals the body
rendered with the same fixture content, brand root, scheme and viewport; the
override block equals the difference of the style tables; and the source
keeps its import boundary. Each generated template, filled with sample
content, has no horizontal overflow at 390px or 1440px in either scheme, and
its action's computed background is that scheme's `accentSolid`. The
generated pages also pass every document, control, responsive and journey
check.

Related: [Mockup catalogue](./mockups.md), [Product mockups](./product-mockups.md),
[Shared controls](./shared-controls.md#email), [Design tokens](./design-tokens.md#email).
