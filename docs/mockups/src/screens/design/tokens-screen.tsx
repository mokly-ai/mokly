import { tokens } from "@mokly-cloud/tokens/tokens";

import { MockLink } from "@mokly/mokly";

import { Button } from "../../entries/design/button.mockup";

export function TokensScreen() {
  const colors = Object.entries(tokens.color.light).flatMap(([name, value]) =>
    typeof value === "string"
      ? [name]
      : Object.entries(value).flatMap(([person, roles]) =>
          Object.keys(roles).map((role) => name + "-" + person + "-" + role),
        ),
  );
  return (
    <main data-mkc-screen="design/tokens" className="tokens-page">
      <p className="eyebrow">Mokly design</p>
      <h1>A shared visual language</h1>
      <section>
        <h2>Color</h2>
        <div className="swatch-grid">
          {colors.map((name) => {
            const variable =
              "--mk-color-" +
              name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
            return (
              <div className="swatch" key={name}>
                <span style={{ background: "var(" + variable + ")" }} />
                <code>{name}</code>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2>Type</h2>
        <div className="type-samples">
          {Object.entries(tokens.type).map(([name, definition]) => (
            <div key={name}>
              <code>{name}</code>
              <p
                style={{
                  fontFamily:
                    name === "editorial"
                      ? "var(--mk-font-display)"
                      : "var(--mk-font-sans)",
                  fontWeight: definition.weight,
                  lineHeight: "var(--mk-type-" + name + "-line)",
                  fontSize:
                    "var(--mk-type-" +
                    name.replace(
                      /[A-Z]/g,
                      (letter) => "-" + letter.toLowerCase(),
                    ) +
                    "-size)",
                }}
              >
                A little clarity goes a long way.
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2>Space and shape</h2>
        <div className="space-samples">
          {Object.entries(tokens.space).map(([step, value]) => (
            <div key={step}>
              <code>{step}</code>
              <span style={{ width: value }} />
            </div>
          ))}
        </div>
        <div className="radius-samples">
          {Object.entries(tokens.radius).map(([name, value]) => (
            <div key={name} style={{ borderRadius: value }}>
              {name}
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2>Actions</h2>
        <div className="actions">
          <MockLink asChild to="design/button">
            <Button
              moklyInstance="tokens-buttons"
              label="Explore buttons"
              tone="primary"
            />
          </MockLink>
          <MockLink asChild to="product/settings/project">
            <Button
              moklyInstance="tokens-product"
              label="Explore product"
              tone="secondary"
            />
          </MockLink>
        </div>
      </section>
    </main>
  );
}
