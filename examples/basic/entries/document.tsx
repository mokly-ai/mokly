import { renderToStaticMarkup } from "react-dom/server";

import { mockLink } from "@mokly/mokly";

/**
 * Complete example document shared by the page and its shell designs. A
 * read-only copy keeps the document's own appearance while its links, like
 * every link in a previous version, do nothing.
 */
export function ExampleDocument({
  readOnly = false,
  welcomeId = "example-welcome",
}: {
  readOnly?: boolean;
  welcomeId?: string;
}) {
  return (
    <article
      style={{
        background: "white",
        color: "#1a1d1c",
        padding: "32px",
        maxWidth: "720px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <p>Example handbook</p>
      <h1 id="overview">Getting started</h1>
      <p>
        Explore the welcome screen, follow the tour, and keep these notes
        nearby.
      </p>
      <h2 id="next-steps">Next steps</h2>
      <ol>
        <li>Open the welcome screen.</li>
        <li>Follow the link to details.</li>
        <li>Return to this handbook whenever you need it.</li>
      </ol>
      <p>
        {readOnly ? (
          <span style={{ color: "#0000ee", textDecoration: "underline" }}>
            Open Welcome
          </span>
        ) : (
          <a href={mockLink(welcomeId)}>Open Welcome</a>
        )}
      </p>
    </article>
  );
}

/** Render one complete, portable HTML document without device variants. */
export function renderExampleDocument(): string {
  return `<!doctype html>${renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Getting started</title>
      </head>
      <body>
        <ExampleDocument />
      </body>
    </html>,
  )}`;
}
