import { collectFirnaStyles, FirnaThemeProvider } from "@firna/ui";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { RenderInput } from "@mokly/mokly";

function Document({ input }: { input: RenderInput }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        {input.stylesheets.map((stylesheet) => (
          <link key={stylesheet} rel="stylesheet" href={stylesheet} />
        ))}
        <style>{collectFirnaStyles()}</style>
      </head>
      <body data-themed-renderer={input.viewport}>
        <FirnaThemeProvider>{input.node as ReactNode}</FirnaThemeProvider>
      </body>
    </html>
  );
}

export default function render(input: RenderInput): string {
  return `<!doctype html>${renderToStaticMarkup(<Document input={input} />)}`;
}
