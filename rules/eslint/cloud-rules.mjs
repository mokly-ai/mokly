/**
 * The ESLint rules of the Mokly Cloud projects under `apps/`, `packages/app/`,
 * and `packages/desktop/`. The root `eslint.config.js` applies them after the
 * repository-wide rules.
 */

import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    // A hand-tuned dependency array is correct exactly once; the rule reads
    // the arrays the application writes, so an effect that stops seeing a
    // value it uses fails the lint.
    files: ["packages/app/src/**/*.{ts,tsx}", "packages/app/app/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    // Node runs the cloud build configuration, scripts, and desktop shell.
    files: [
      "apps/**/*.cjs",
      "packages/{app,desktop}/**/*.cjs",
      "packages/app/*.config.js",
      "apps/*/scripts/**",
      "packages/{app,desktop}/scripts/**",
      "packages/desktop/**/*.ts",
    ],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // The browser defines these as globals on `window`, so a handler that
    // means a local `close` or `open` and is not bound to one ships as a
    // control that silently does nothing.
    files: ["packages/app/src/**/*.{ts,tsx}", "packages/app/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...[
          "alert",
          "blur",
          "close",
          "confirm",
          "event",
          "find",
          "focus",
          "history",
          "length",
          "location",
          "name",
          "navigator",
          "open",
          "parent",
          "print",
          "screen",
          "scroll",
          "self",
          "status",
          "stop",
          "top",
        ].map((name) => ({
          name,
          message: `\`${name}\` here is the browser's global, not anything this module declared. Bind the name you meant.`,
        })),
      ],
    },
  },
  {
    // A settings pane is hosted by the dialog or the full-screen layer, and
    // both guard what the reader has typed on the way out. A pane asks its
    // host to leave instead of driving the router, and its external links
    // open a tab of their own.
    files: ["packages/app/src/settings/panes/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='href'], Property[key.name='href']",
          message:
            "A pane addresses another pane with PaneLink, and leaves settings through useSettings().leaveTo, leaveBy or leaveConfirmed, so the host can ask about unsaved work first.",
        },
        {
          selector:
            "JSXElement[openingElement.name.name='ExternalLink']:not(:has(JSXOpeningElement > JSXAttribute[name.name='newTab']))",
          message:
            "A pane's ExternalLink opens a tab of its own, so the pane keeps its place and whatever the reader typed on it. Pass newTab.",
        },
        {
          selector:
            "JSXAttribute[name.name='newTab'] > JSXExpressionContainer > Literal[value=false]",
          message:
            "A pane's ExternalLink opens a tab of its own; leaving in this one is a door past the host's unsaved-work guard.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["expo-router", "expo-router/*"],
              message:
                "A pane leaves settings through useSettings().leaveTo, leaveBy or leaveConfirmed, so the host can ask about unsaved work first.",
            },
          ],
        },
      ],
    },
  },
];
